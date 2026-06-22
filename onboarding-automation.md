# Autotask onboarding automation — build spec

Code-on-Vercel pipeline that detects onboarding tickets in Autotask, sends the
client a form, and turns the response into requisition + provisioning work — with
optional Microsoft 365 user provisioning as a later phase.

Stack: Next.js (App Router) on Vercel · Supabase (Postgres) · AWS SES · Autotask REST.

---

## Architecture

```
Vercel Cron ──poll──> Autotask REST        (find new onboarding tickets)
     │
     ├─ insert row in Supabase (status=new, signed token)
     ├─ SES: email client the form link
     └─ set status=form_sent

Client ──> /onboard/[token]  (Next.js form page)
     │
     └─ POST /api/onboard/submit
            ├─ verify token
            ├─ Autotask REST: write response back to ticket
            ├─ Autotask REST: create requisition task (if hardware) + provisioning checklist
            └─ set status=form_received

Vercel Cron (same job) also reconciles: re-drives rows stuck in form_sent / error.
```

**Why polling, not a webhook:** Autotask has **no Ticket webhook entity** — webhooks
only fire for Company, Contact, and TicketNotes. Rather than fight that with a
workflow-rule extension callout (clunky payload), a cron poll every ~10 min is
simpler and onboarding is not latency-sensitive. The same cron is also the
durability layer.

---

## Environment variables

```bash
# --- Autotask REST ---
AUTOTASK_USERNAME=                 # API User username
AUTOTASK_SECRET=                   # API User secret
AUTOTASK_INTEGRATION_CODE=         # ApiIntegrationCode
AUTOTASK_API_BASE_URL=             # zone URL, e.g. https://webservices3.autotask.net/atservicesrest/v1.0
AUTOTASK_ONBOARDING_CATEGORY_ID=   # picklist id matched in the poll query
AUTOTASK_STAGE_UDF_NAME=           # onboarding_stage UDF field name

# --- Supabase ---
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=         # server-only — never NEXT_PUBLIC

# --- AWS SES ---
# Custom-prefixed on purpose: the Vercel/Lambda runtime injects its own AWS_* vars,
# so bare AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY get shadowed. Pass these explicitly.
SES_AWS_REGION=ap-southeast-2
SES_AWS_ACCESS_KEY_ID=
SES_AWS_SECRET_ACCESS_KEY=
ONBOARDING_FROM_EMAIL=             # SES-verified sender identity

# --- Correlation token ---
FORM_TOKEN_SECRET=                 # HMAC key for signing the form token

# --- App / cron ---
APP_BASE_URL=                      # canonical custom domain, used to build emailed form links
CRON_SECRET=                       # Vercel injects this into cron requests; verify it in the route

# --- Microsoft Graph (Phase 2, single pilot tenant) ---
MS_GRAPH_CLIENT_ID=
MS_GRAPH_CLIENT_SECRET=
MS_GRAPH_TENANT_ID=
```

### Gotchas

- **`AUTOTASK_API_BASE_URL` is pinned, not resolved per request.** Call
  `GET /zoneInformation` once by hand, grab the zone URL, set it as the env var.
  Zone is stable per tenant; resolving it every invocation just burns a round-trip.
- **`APP_BASE_URL`, not `VERCEL_URL`.** `VERCEL_URL` is the per-deployment hostname —
  wrong for a link you email a customer (it rots on every redeploy). Use your canonical
  domain.
- **`SUPABASE_SERVICE_ROLE_KEY` is server-only.** All routes are server-side, so service
  role is correct (writes the state table, bypasses RLS). Never give it a `NEXT_PUBLIC_`
  prefix.
- **Graph vars don't scale as env vars.** The moment a second client tenant exists,
  tenant/client/secret become *per-company* config keyed by `company_id` in a table, not
  env. Env is fine only for the single pilot tenant.

---

## AWS SES setup

1. **Verify the sender identity** (domain + DKIM) in the `SES_AWS_REGION` region.
2. **Request production access** in that same region. Until then SES is in *sandbox*
   and can only send to verified addresses — arbitrary client recipients are rejected.
3. **IAM user, least privilege.** Vercel isn't AWS compute, so there's no IAM role to
   assume — you need an IAM user with access keys. Scope its policy to `ses:SendEmail`
   and `ses:SendRawEmail` only.

```ts
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({
  region: process.env.SES_AWS_REGION,
  credentials: {
    accessKeyId: process.env.SES_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.SES_AWS_SECRET_ACCESS_KEY!,
  },
});
```

Pass credentials explicitly as above — do not rely on the default provider chain, which
will pick up the Lambda runtime's own AWS credentials.

---

## Route structure

```
app/
  api/
    cron/poll-onboarding/route.ts   # GET — Vercel Cron: find new onboarding tickets, send links, reconcile stuck rows
    onboard/submit/route.ts         # POST — customer submission: verify token, writeback, create tasks
  onboard/[token]/page.tsx          # the form (server component, loads row by token)
lib/
  autotask.ts                       # REST client: auth headers, zone, GET/PATCH/POST helpers
  token.ts                          # sign() / verify() HMAC with FORM_TOKEN_SECRET
  supabase.ts                       # server client (service role)
  mailer.ts                         # SES send-form-link
vercel.json                         # cron schedule
```

### `vercel.json`

```json
{
  "crons": [{ "path": "/api/cron/poll-onboarding", "schedule": "*/10 * * * *" }]
}
```

Verify `CRON_SECRET` at the top of the cron route so the endpoint can't be hit externally
(Vercel sends it as a bearer token on cron invocations).

---

## Supabase schema

`ticket_id unique` is what gives idempotency for free — the poll's insert becomes
`on conflict do nothing`, so a ticket is never processed twice.

```sql
create table onboarding_runs (
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
create index on onboarding_runs (status);

alter table onboarding_runs enable row level security;
-- no policies: only the service-role server routes touch this table
```

---

## State machine + idempotency

```
new ──> form_sent ──> form_received ──> provisioned ──> complete
                 └──────────> error (side state, cron retries)
```

- **Cron does double duty:** transition `new` rows (send the link → `form_sent`) and
  re-drive anything stuck in `form_sent` past a threshold or sitting in `error`.
- **Submit route only acts on the `form_received` transition,** keyed on
  `ticket_id + status`, so a double-submit can't create duplicate tasks.
- **Keep handlers thin.** Vercel function timeouts are short by default — process one
  ticket per invocation (or fan out) and return fast rather than chaining many sequential
  Autotask calls. Raise `maxDuration` only if genuinely needed.

---

## Autotask notes

- **Auth:** three static headers on every REST call — `UserName`, `Secret`,
  `ApiIntegrationCode`. These are separate from SSO credentials.
- **API User:** create under Admin → Resources/Users with a security level that has the
  ticket entity permissions you need (read tickets, create tasks, patch tickets/UDFs).
- **Poll query:** `GET /Tickets` filtered on category = `AUTOTASK_ONBOARDING_CATEGORY_ID`
  and the `AUTOTASK_STAGE_UDF_NAME` UDF = `new`. Have a workflow rule in Autotask set that
  UDF (and categorise) on inbound onboarding tickets so the poll has a clean signal.
- **Writeback:** PATCH the ticket note/UDFs, then POST the requisition task (conditional on
  hardware) and the provisioning checklist task, pre-filled from the form payload.

---

## Build order

1. Stand up the Next.js project + Supabase table. Confirm Autotask auth works:
   `GET /zoneInformation`, then a `GET /Tickets` from a server route. **This is the gate** —
   nothing downstream matters until auth + zone resolve.
2. Autotask workflow rule: categorise onboarding tickets + set `onboarding_stage = new`.
3. Cron poll → insert row + SES form link. Verify SES is out of sandbox first.
4. Form page + token verify.
5. Submit route: writeback + task creation. **Phase 1 done** — humans action hardware and
   M365 setup from pre-filled tasks.
6. Phase 2: Graph provisioning as a separate route triggered off the checklist task. Move
   tenant creds to a per-`company_id` config table once there's more than one tenant.
```