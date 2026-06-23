import type { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import { STATUS } from "@/lib/onboarding";

export const runtime = "nodejs";

/**
 * Operator-triggered resend lever.
 *
 *   POST /api/onboard/resend?ticketId=12345
 *
 * Flips `resend_requested` on a single run so the next poll cycle mails one
 * more form link, then clears the flag. Authed with the same CRON_SECRET as the
 * poll — this is an internal/admin lever, not a public endpoint. The status
 * guard means only an already-sent (`form_sent`) or failed (`error`) run can be
 * resent, so we never re-mail a form that was never sent or already received.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (
    request.headers.get("authorization") !==
    `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const ticketIdRaw = request.nextUrl.searchParams.get("ticketId");
  const ticketId = Number(ticketIdRaw);
  if (!ticketIdRaw || !Number.isInteger(ticketId) || ticketId <= 0) {
    return Response.json(
      { error: "ticketId query param (positive integer) is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin()
    .from("onboarding_runs")
    .update({
      resend_requested: true,
      updated_at: new Date().toISOString(),
    })
    .eq("ticket_id", ticketId)
    .in("status", [STATUS.FORM_SENT, STATUS.ERROR])
    .select("id, ticket_id, status");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return Response.json(
      {
        error: `no resendable onboarding run for ticket ${ticketId} (must be in form_sent or error)`,
      },
      { status: 404 }
    );
  }

  return Response.json({ ok: true, queued: data[0] });
}
