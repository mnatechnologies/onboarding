-- Onboarding state table.
--
-- `ticket_id unique` is what gives idempotency for free — the poll's insert
-- becomes `on conflict (ticket_id) do nothing`, so a ticket is never processed
-- twice. RLS is enabled with no policies: only the service-role server routes
-- touch this table.

create table if not exists onboarding_runs (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     bigint not null unique,
  company_id    bigint not null,
  contact_email text,
  token         text not null unique,
  status        text not null default 'new',
  payload       jsonb,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists onboarding_runs_status_idx on onboarding_runs (status);

alter table onboarding_runs enable row level security;
-- no policies: only the service-role server routes touch this table
