-- Migration: per-client Microsoft 365 tenant mapping (Phase 2, multi-tenant).
--
-- One shared multi-tenant app registration (client_id/secret in env) is
-- admin-consented into each client tenant. Only the tenant id is per-client,
-- keyed on the Autotask company_id carried on every onboarding row. No secrets
-- live here — the shared app's credentials stay in env.
--
-- Idempotent: safe to run more than once.

create table if not exists company_m365 (
  company_id          bigint primary key,        -- Autotask company id
  tenant_id           text not null,             -- the client's Entra (Azure AD) tenant id
  onmicrosoft_domain  text,                       -- optional, e.g. clientx.onmicrosoft.com
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table company_m365 enable row level security;
-- no policies: only the service-role server routes read this table
