export const runtime = "nodejs";
export const maxDuration = 60;

import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { addTicketNote, createTask } from "@/lib/autotask";
import {
  provisionUser,
  findSkuByPartNumber,
  assignLicense,
} from "@/lib/graph";
import { STATUS, type OnboardingPayload } from "@/lib/onboarding";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateTempPassword(): string {
  // 18 random bytes -> 24-char base64url + fixed suffix satisfying complexity
  // requirements (uppercase, lowercase, digit, special character).
  return `${randomBytes(18).toString("base64url")}Aa1!`;
}

function deriveMailNickname(firstName: string, lastName: string): string {
  const sanitize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9.]/g, "");
  return `${sanitize(firstName)}.${sanitize(lastName)}`;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

type ProvisionRow = {
  status: string;
  payload: OnboardingPayload | null;
  company_id: number;
};

export async function POST(request: Request): Promise<Response> {
  // 1. AUTH: require Bearer <CRON_SECRET>
  const authHeader = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof rawBody !== "object" ||
    rawBody === null ||
    typeof (rawBody as Record<string, unknown>)["ticketId"] !== "number"
  ) {
    return Response.json(
      { error: "Body must contain a numeric ticketId" },
      { status: 400 }
    );
  }

  const ticketId = (rawBody as Record<string, unknown>)["ticketId"] as number;

  // 3. Look up the onboarding run
  const { data: row, error: fetchError } = await supabaseAdmin()
    .from("onboarding_runs")
    .select("status, payload, company_id")
    .eq("ticket_id", ticketId)
    .maybeSingle<ProvisionRow>();

  if (fetchError) {
    console.error("[provision] Supabase fetch error:", fetchError);
    return Response.json({ error: "Database error." }, { status: 500 });
  }

  if (!row) {
    return Response.json(
      { error: "Onboarding run not found" },
      { status: 404 }
    );
  }

  if (row.status !== STATUS.FORM_RECEIVED || !row.payload) {
    return Response.json(
      { error: "not ready for provisioning" },
      { status: 409 }
    );
  }

  // 4. Guard: Graph must be configured
  if (!process.env.MS_GRAPH_CLIENT_ID) {
    return Response.json(
      { error: "Microsoft Graph not configured" },
      { status: 501 }
    );
  }

  // 5. Resolve M365 tenant for this company
  const { data: mapping } = await supabaseAdmin()
    .from("company_m365")
    .select("tenant_id, active")
    .eq("company_id", row.company_id)
    .maybeSingle();

  const m = mapping as { tenant_id: string; active: boolean } | null;

  if (!m || m.active === false || !m.tenant_id) {
    // Best-effort ticket note — don't let a failure here mask the real error
    try {
      await addTicketNote(
        ticketId,
        "M365 provisioning blocked",
        `No active M365 tenant mapping for Autotask company ${row.company_id}. Add a row to company_m365.`
      );
    } catch (noteErr) {
      console.error(
        "[provision] Failed to add blocking ticket note:",
        noteErr instanceof Error ? noteErr.message : String(noteErr)
      );
    }

    await supabaseAdmin()
      .from("onboarding_runs")
      .update({
        status: STATUS.ERROR,
        error: `no M365 tenant mapping for company ${row.company_id}`,
        updated_at: new Date().toISOString(),
      })
      .eq("ticket_id", ticketId);

    return Response.json(
      { status: "blocked", reason: "no tenant mapping" },
      { status: 409 }
    );
  }

  const tenantId = m.tenant_id;

  // 6. Build user inputs from payload
  const payload = row.payload;
  const displayName = `${payload.employeeFirstName} ${payload.employeeLastName}`;
  const mailNickname = deriveMailNickname(
    payload.employeeFirstName,
    payload.employeeLastName
  );
  const tempPassword = generateTempPassword();
  const partNumber =
    process.env.MS_LICENSE_SKU_PART_NUMBER ?? "O365_BUSINESS_PREMIUM";

  // 7. Graph work — any failure here marks the row ERROR and returns 502
  let createdUser: { id: string; userPrincipalName: string };
  let skuAvailable: boolean;
  let skuFound: boolean;
  let skuId: string | undefined;

  try {
    createdUser = await provisionUser(tenantId, {
      displayName,
      mailNickname,
      userPrincipalName: payload.employeeEmail,
      password: tempPassword,
    });

    const sku = await findSkuByPartNumber(tenantId, partNumber);
    skuFound = sku !== null;
    skuAvailable = sku !== null && sku.available > 0;

    if (skuAvailable && sku !== null) {
      skuId = sku.skuId;
      await assignLicense(tenantId, createdUser.id, sku.skuId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[provision] Graph operation failed:", message);

    await supabaseAdmin()
      .from("onboarding_runs")
      .update({
        status: STATUS.ERROR,
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("ticket_id", ticketId);

    return Response.json(
      { error: "Microsoft Graph operation failed." },
      { status: 502 }
    );
  }

  // 8. Post-Graph Autotask writeback + row update (mirrors submit/route.ts pattern)
  if (skuAvailable && skuId !== undefined) {
    // Path A: user created and license assigned
    try {
      await addTicketNote(
        ticketId,
        "M365 user provisioned",
        `Created ${createdUser.userPrincipalName} and assigned ${partNumber}.`
      );

      await supabaseAdmin()
        .from("onboarding_runs")
        .update({
          status: STATUS.COMPLETE,
          updated_at: new Date().toISOString(),
        })
        .eq("ticket_id", ticketId);
    } catch (err) {
      // User + license are confirmed in Azure; log but don't 502
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        "[provision] Post-provision writeback failed (user+license created):",
        message
      );
    }

    return Response.json({
      status: "complete",
      userPrincipalName: createdUser.userPrincipalName,
      licenseAssigned: true,
    });
  }

  // Path B: user created but no free seat — flag for Synnex ordering
  const reason = skuFound ? "no free seat" : "sku not in tenant";

  try {
    await addTicketNote(
      ticketId,
      "M365 user created — license pending",
      `Created ${createdUser.userPrincipalName}. No free ${partNumber} seat — order one from Synnex, then assign.`
    );

    await createTask({
      companyId: row.company_id,
      title: `Order M365 Business Standard from Synnex – ${createdUser.userPrincipalName}`,
      description: `A new seat for ${partNumber} must be ordered from Synnex and assigned to ${createdUser.userPrincipalName}.`,
      queueId: process.env.AUTOTASK_REQUISITION_QUEUE_ID
        ? Number(process.env.AUTOTASK_REQUISITION_QUEUE_ID)
        : undefined,
    });

    await supabaseAdmin()
      .from("onboarding_runs")
      .update({
        status: STATUS.PROVISIONED,
        updated_at: new Date().toISOString(),
      })
      .eq("ticket_id", ticketId);
  } catch (err) {
    // User exists in Azure unlicensed; log but don't 502 — the status update
    // may have partially succeeded; a retry would re-read PROVISIONED and skip.
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[provision] Synnex-flag writeback failed (user created, unlicensed):",
      message
    );
  }

  return Response.json({
    status: "provisioned",
    userPrincipalName: createdUser.userPrincipalName,
    licenseAssigned: false,
    reason,
  });
}
