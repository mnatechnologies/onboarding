-- Adds the once-only send gate and the explicit resend lever to onboarding_runs.
--
-- Background: the poll used to re-mail any `form_sent` row whose form was not
-- filled within an hour, so a pending form got a fresh email every poll cycle.
-- These two columns replace that timer with deterministic, persisted state.
--
-- form_sent_at:     null until the form link is emailed, set when it is. The
--                   poll gates the initial send on `form_sent_at is null`, so a
--                   link is mailed at most once even if the row passes through
--                   the `error` state.
-- resend_requested: operator-set flag (via POST /api/onboard/resend). The poll
--                   sends one more link to rows with this set, then clears it.

alter table onboarding_runs
  add column if not exists form_sent_at     timestamptz,
  add column if not exists resend_requested boolean not null default false;

-- Backfill: rows already at or past form_sent have effectively been sent.
-- Stamp them so the new gate never re-mails an existing in-flight onboarding.
update onboarding_runs
  set form_sent_at = coalesce(updated_at, now())
  where form_sent_at is null
    and status in ('form_sent', 'form_received', 'provisioned', 'complete');

-- Partial index: the resend query reads only the (rare) rows with the flag set.
create index if not exists onboarding_runs_resend_idx
  on onboarding_runs (resend_requested)
  where resend_requested;
