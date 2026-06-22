export const runtime = "nodejs";
export const maxDuration = 60;

import { supabaseAdmin } from "@/lib/supabase";
import { addTicketNote } from "@/lib/autotask";
import { provisionUser } from "@/lib/graph";
import { STATUS, type OnboardingRun, type OnboardingPayload } from "@/lib/onboarding";
import { randomBytes } from "node:crypto";

function generateTempPassword(): string {
  // 24 random bytes -> 32-char base64url string; meets most password complexity rules
  return randomBytes(24).toString("base64url");
}

function deriveMailNickname(firstName: string, lastName: string): string {
  // Lowercase, strip non-alphanumeric, combine as firstlast
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${clean(firstName)}${clean(lastName)}`;
}

export async function POST(request: Request): Promise<Response> {
  // Auth: require Bearer <CRON_SECRET>
  const authHeader = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
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

  // Look up the onboarding run
  const { data: row, error: fetchError } = await supabaseAdmin()
    .from("onboarding_runs")
    .select("*")
    .eq("ticket_id", ticketId)
    .maybeSingle<OnboardingRun>();

  if (fetchError) {
    console.error("[provision] Supabase fetch error:", fetchError);
    return Response.json({ error: "Database error." }, { status: 500 });
  }

  if (!row) {
    return Response.json({ error: "Onboarding run not found" }, { status: 404 });
  }

  if (row.status !== STATUS.FORM_RECEIVED || !row.payload) {
    return Response.json(
      { error: "not ready for provisioning" },
      { status: 409 }
    );
  }

  // Guard: Graph must be configured
  if (!process.env.MS_GRAPH_TENANT_ID) {
    return Response.json(
      { error: "Microsoft Graph not configured" },
      { status: 501 }
    );
  }

  const payload = row.payload as OnboardingPayload;
  const displayName = `${payload.employeeFirstName} ${payload.employeeLastName}`;
  const mailNickname = deriveMailNickname(
    payload.employeeFirstName,
    payload.employeeLastName
  );
  const tempPassword = generateTempPassword();

  let provisionResult: { id: string; userPrincipalName: string };

  try {
    provisionResult = await provisionUser({
      displayName,
      mailNickname,
      userPrincipalName: payload.employeeEmail,
      password: tempPassword,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[provision] provisionUser failed:", message);

    await supabaseAdmin()
      .from("onboarding_runs")
      .update({
        status: STATUS.ERROR,
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("ticket_id", ticketId);

    return Response.json(
      { error: "Microsoft Graph user creation failed." },
      { status: 502 }
    );
  }

  // Update row to COMPLETE and add ticket note
  try {
    await supabaseAdmin()
      .from("onboarding_runs")
      .update({
        status: STATUS.COMPLETE,
        updated_at: new Date().toISOString(),
      })
      .eq("ticket_id", ticketId);

    await addTicketNote(
      ticketId,
      "M365 user provisioned",
      `Created ${provisionResult.userPrincipalName}`
    );
  } catch (err) {
    // The user was created successfully in Azure; log but don't 502
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[provision] Post-provision cleanup failed (user was created):",
      message
    );
  }

  return Response.json({
    status: "complete",
    userPrincipalName: provisionResult.userPrincipalName,
  });
}
