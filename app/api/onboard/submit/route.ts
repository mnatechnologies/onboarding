export const runtime = "nodejs";
export const maxDuration = 60;

import { supabaseAdmin } from "@/lib/supabase";
import { verifyToken } from "@/lib/token";
import { addTicketNote, patchTicket, createTask } from "@/lib/autotask";
import {
  STATUS,
  submitRequestSchema,
  type OnboardingPayload,
} from "@/lib/onboarding";

function buildNoteDescription(payload: OnboardingPayload): string {
  const lines: string[] = [
    `Employee: ${payload.employeeFirstName} ${payload.employeeLastName}`,
    `Email: ${payload.employeeEmail}`,
    `Job title: ${payload.jobTitle}`,
    `Department: ${payload.department || "(not specified)"}`,
    `Start date: ${payload.startDate}`,
    `Needs hardware: ${payload.needsHardware ? "Yes" : "No"}`,
  ];

  if (payload.needsHardware && payload.hardwareDetails) {
    lines.push(`Hardware details: ${payload.hardwareDetails}`);
  }

  if (payload.softwareNeeded) {
    lines.push(`Software needed: ${payload.softwareNeeded}`);
  }

  if (payload.notes) {
    lines.push(`Additional notes: ${payload.notes}`);
  }

  return lines.join("\n");
}

function buildProvisioningDescription(
  payload: OnboardingPayload,
  fullName: string
): string {
  const lines: string[] = [
    `Employee: ${fullName}`,
    `Email: ${payload.employeeEmail}`,
    `Job title: ${payload.jobTitle}`,
    `Department: ${payload.department || "(not specified)"}`,
    `Start date: ${payload.startDate}`,
  ];

  if (payload.softwareNeeded) {
    lines.push(`Software needed: ${payload.softwareNeeded}`);
  }

  if (payload.notes) {
    lines.push(`Notes: ${payload.notes}`);
  }

  return lines.join("\n");
}

export async function POST(request: Request): Promise<Response> {
  // Parse and validate request body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = submitRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return Response.json(
      { error: firstIssue?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { token, ...formFields } = parsed.data;
  const payload = formFields as OnboardingPayload;

  // Verify HMAC token
  const decoded = verifyToken(token);
  if (!decoded) {
    return Response.json({ error: "Invalid token" }, { status: 400 });
  }

  // Idempotent transition: only update if status is still FORM_SENT
  const { data: updated, error: updateError } = await supabaseAdmin()
    .from("onboarding_runs")
    .update({
      status: STATUS.FORM_RECEIVED,
      payload,
      updated_at: new Date().toISOString(),
    })
    .eq("ticket_id", decoded.ticketId)
    .eq("token", token)
    .eq("status", STATUS.FORM_SENT)
    .select();

  if (updateError) {
    console.error("[onboard/submit] Supabase update error:", updateError);
    return Response.json(
      { error: "Database error. Please try again." },
      { status: 500 }
    );
  }

  // If no rows were updated the form was already submitted — return 200 (idempotent)
  if (!updated || updated.length === 0) {
    return Response.json({ status: "already_received" }, { status: 200 });
  }

  const row = updated[0] as { company_id: number };
  const companyId = row.company_id;
  const fullName = `${payload.employeeFirstName} ${payload.employeeLastName}`;

  // Autotask writeback — wrap everything so a failure can be captured without
  // leaving the row in an ambiguous state.
  try {
    // 1. Add a human-readable note to the ticket
    await addTicketNote(
      decoded.ticketId,
      "Onboarding form received",
      buildNoteDescription(payload)
    );

    // 2. Advance the stage UDF so Autotask workflows can fire
    await patchTicket(
      decoded.ticketId,
      {},
      [
        {
          name: process.env.AUTOTASK_STAGE_UDF_NAME ?? "OnboardingStage",
          value: "form_received",
        },
      ]
    );

    // 3. Conditionally create a hardware requisition task
    if (payload.needsHardware) {
      await createTask({
        companyId,
        title: `Hardware requisition – ${fullName}`,
        description: payload.hardwareDetails || "(no details provided)",
        queueId: process.env.AUTOTASK_REQUISITION_QUEUE_ID
          ? Number(process.env.AUTOTASK_REQUISITION_QUEUE_ID)
          : undefined,
      });
    }

    // 4. Always create a provisioning checklist task
    await createTask({
      companyId,
      title: `Provisioning checklist – ${fullName}`,
      description: buildProvisioningDescription(payload, fullName),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[onboard/submit] Autotask writeback failed:", message);

    // Record the error on the row so it can be investigated / retried
    await supabaseAdmin()
      .from("onboarding_runs")
      .update({
        status: STATUS.ERROR,
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("ticket_id", decoded.ticketId)
      .eq("token", token);

    return Response.json(
      { error: "Autotask writeback failed. Please contact IT support." },
      { status: 502 }
    );
  }

  return Response.json({ status: "received" });
}
