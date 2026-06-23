# Hosting the onboarding form at `onboard.mnatechnologies.com.au`

This app (the Autotask onboarding automation) deploys as **its own Vercel project**, served
at a subdomain of the marketing domain. It is intentionally **separate** from the MNAWeb
marketing site so the Supabase service-role key, Autotask secrets, cron, and M365 Graph
credentials never live in the marketing repo. The two coexist on DNS:

| Host | Points to | Project |
|------|-----------|---------|
| `mnatechnologies.com.au` / `www` | marketing site | MNAWeb |
| `onboard.mnatechnologies.com.au` | this app | `mna_automation` |

The branding (logo, Inter, `#0066cc`/`#00b4d8`, card styling) is mirrored from MNAWeb so the
form reads as a first-party page. The logo lives at `public/branding/logo.png`.

## 1. Add the domain in Vercel
Vercel → the `mna_automation` project → **Settings → Domains → Add** →
`onboard.mnatechnologies.com.au`. Vercel will show the DNS record it wants.

## 2. DNS (at whoever hosts `mnatechnologies.com.au`)
Add a **CNAME** record — this only affects the `onboard` subdomain, not the apex marketing site:

```
onboard   CNAME   cname.vercel-dns.com.
```

(If your DNS provider can't CNAME and Vercel offers an A record instead, use that. Apex
records for the marketing site are untouched.)

## 3. Environment variables (Vercel → this project → Settings → Environment Variables)
Set everything from `.env.example`. The subdomain-specific ones:

```
APP_BASE_URL=https://onboard.mnatechnologies.com.au   # builds the emailed /onboard/[token] links
ONBOARDING_FROM_EMAIL=onboarding@mnatechnologies.com.au  # must be an SES-verified identity
```

Plus the existing Autotask / Supabase / SES / `FORM_TOKEN_SECRET` / `CRON_SECRET` / MS Graph
values. `APP_BASE_URL` is what the cron uses to build the link it emails — it must be the
canonical subdomain, **not** `VERCEL_URL` (which rots per-deploy).

## 4. AWS SES
Verify the `mnatechnologies.com.au` domain (DKIM) in `SES_AWS_REGION` (ap-southeast-2) and
confirm the account has **production access** in that region — in sandbox, SES only sends to
verified addresses, so client recipients are rejected. See `onboarding-automation.md` § AWS SES.

## 5. Cron
`vercel.json` already schedules `GET /api/cron/poll-onboarding` every 10 min. Vercel injects
`CRON_SECRET`; the route verifies it. No extra setup.

## Result
The poll emails each client a link like
`https://onboard.mnatechnologies.com.au/onboard/<signed-token>`, which opens the
MNA-branded form. Visiting the bare subdomain shows a branded "use your invited link" page.
