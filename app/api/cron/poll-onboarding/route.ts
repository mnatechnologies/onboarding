import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import { signToken } from "@/lib/token";
import { queryTickets, patchTicket } from "@/lib/autotask";
import type { AutotaskFilterItem } from "@/lib/autotask";
import { sendFormLink } from "@/lib/mailer";
import { STATUS } from "@/lib/onboarding";
import type { OnboardingRun } from "@/lib/onboarding";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<Response> {
  // 1) AUTH: verify Vercel Cron secret
  if (
    request.headers.get("authorization") !==
    `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2) DISCOVER: query Autotask for onboarding tickets awaiting a form link.
  // The "Onboarding Stage" UDF is the single source of truth: an Autotask
  // workflow rule sets it to "new" on tickets whose Issue Type = Onboarding,
  // and this poll flips it to "form_sent" once the link is emailed — so a
  // ticket is matched exactly once.
  const filters: AutotaskFilterItem[] = [
    {
      op: "eq",
      field: process.env.AUTOTASK_STAGE_UDF_NAME as string,
      value: "new",
      udf: true,
    },
  ];

  const tickets = await queryTickets(filters);

  const upsertRows = tickets.map((ticket) => {
    const nonce = randomUUID();
    const token = signToken({ ticketId: ticket.id, nonce });

    const rawEmail = ticket.contactEmailAddress;
    const contact_email: string | null =
      rawEmail !== undefined && rawEmail !== null
        ? String(rawEmail)
        : null;

    return {
      ticket_id: ticket.id,
      company_id: ticket.companyID,
      contact_email,
      token,
      status: STATUS.NEW,
    };
  });

  if (upsertRows.length > 0) {
    await supabaseAdmin()
      .from("onboarding_runs")
      .upsert(upsertRows, { onConflict: "ticket_id", ignoreDuplicates: true });
  }

  const discovered = upsertRows.length;

  // 3) DRIVE + RECONCILE: find rows that need a form link sent
  const staleThreshold = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [actionableResult, staleResult] = await Promise.all([
    supabaseAdmin()
      .from("onboarding_runs")
      .select("*")
      .or("status.eq.new,status.eq.error")
      .limit(25),
    supabaseAdmin()
      .from("onboarding_runs")
      .select("*")
      .eq("status", "form_sent")
      .lt("updated_at", staleThreshold)
      .limit(25),
  ]);

  // Merge and deduplicate by id
  const seen = new Set<string>();
  const rowsToProcess: OnboardingRun[] = [];

  for (const row of [
    ...(actionableResult.data ?? []),
    ...(staleResult.data ?? []),
  ]) {
    const run = row as OnboardingRun;
    if (!seen.has(run.id)) {
      seen.add(run.id);
      rowsToProcess.push(run);
    }
  }

  let sent = 0;
  let errored = 0;

  for (const row of rowsToProcess) {
    try {
      // No contact email — mark error and skip
      if (!row.contact_email) {
        await supabaseAdmin()
          .from("onboarding_runs")
          .update({
            status: STATUS.ERROR,
            error: "no contact email on ticket",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        errored++;
        continue;
      }

      const baseUrl = (process.env.APP_BASE_URL ?? "").replace(/\/+$/, "");
      const formUrl = `${baseUrl}/onboard/${row.token}`;

      await sendFormLink({ to: row.contact_email, formUrl });

      // Patch Autotask UDF so the ticket drops out of the poll filter
      await patchTicket(
        row.ticket_id,
        {},
        [
          {
            name: process.env.AUTOTASK_STAGE_UDF_NAME as string,
            value: "form_sent",
          },
        ]
      );

      await supabaseAdmin()
        .from("onboarding_runs")
        .update({
          status: STATUS.FORM_SENT,
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      sent++;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);

      await supabaseAdmin()
        .from("onboarding_runs")
        .update({
          status: STATUS.ERROR,
          error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      errored++;
    }
  }

  return Response.json({ discovered, sent, errored });
}
