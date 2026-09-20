# CRM

A simple, mobile-friendly CRM for managing leads, sales reps, and follow-ups.

## Stack

- Next.js 15 (App Router) + TypeScript
- Prisma + SQLite (swap the datasource for Postgres/MySQL in production by
  changing `prisma/schema.prisma`'s `provider` and `DATABASE_URL`)
- NextAuth (credentials login, JWT sessions, role-based access)
- Tailwind CSS

## Features

- **Admin panel**: create leads, create/deactivate sales reps, assign leads
  to reps, reassign at any time.
- **Lead pipeline**: New → Contacted → Qualified → Proposal Sent →
  Negotiation → Won/Lost. Anyone assigned to a lead can move it through the
  pipeline; every change is recorded.
- **Per-lead activity log**: log calls with an outcome (Connected, Not
  Connected, No Answer, Voicemail, Callback Requested) — calls are numbered
  automatically ("Call 1", "Call 2", ...) — plus free-text notes and an
  automatic entry whenever the status changes.
- **Follow-up reminders**: schedule a follow-up on any lead; see overdue and
  upcoming follow-ups on a dedicated page, and mark them done. An optional
  cron endpoint (`/api/cron/reminders`) emails reps about follow-ups that are
  due, if SMTP is configured.
- **Admin dashboard**: revenue won, pipeline value, conversion rate, average
  deal size, average time to close, pipeline-by-stage funnel with average
  time spent in each stage, and revenue/conversion per sales rep.
- **Role-based access**: admins see everything; sales reps only see and act
  on leads assigned to them, and can't reach admin pages.
- Responsive layout with a mobile bottom tab bar and a desktop top nav.

## Getting started

```bash
npm install
cp .env.example .env      # fill in NEXTAUTH_SECRET (any random string) and,
                           # optionally, the seed admin credentials
npm run db:migrate        # creates the SQLite database and applies the schema
                           # (this also seeds an initial admin user)
npm run dev
```

Visit http://localhost:3000 and log in with the seed admin credentials from
`.env` (defaults: `admin@example.com` / `ChangeMe123!` — change the password
after first login by editing the user, or create additional admins from the
Team page).

From the Team page (as an admin) you can add sales reps, who log in with the
email/password you set for them.

## Deploying to a VPS (recommended, ~$4-6/month)

This gets the app live on a small always-on server, with SQLite left exactly
as-is (the server's disk is persistent, unlike serverless platforms).

**1. Create the cheapest VPS you can find** running **Ubuntu 22.04 or 24.04**,
at least 1GB RAM (2GB is safer for the build step) — e.g. a Hetzner CX22, a
DigitalOcean Basic Droplet, or a Vultr/Linode equivalent. Any provider works;
this doesn't depend on which one you pick.

**2. Open a terminal to it.** Either SSH from your own machine:

```bash
ssh root@YOUR_SERVER_IP
```

or use the provider's browser-based console (every major one has one) if you
don't have an SSH client set up.

**3. Run one command:**

```bash
curl -fsSL https://raw.githubusercontent.com/bhavansh-arora/crm/claude/crm-admin-lead-management-2dea2w/deploy/setup-vps.sh -o setup-vps.sh
bash setup-vps.sh
```

It will ask for an admin email/password (or auto-generate a password) and
optionally a domain name, then install Docker, build the app, start it, and
schedule the follow-up reminder check — unattended from there. It prints the
live URL and admin login when it's done.

**No domain yet?** It'll run on `http://<server-ip>` immediately. Get a cheap
domain later (~$10/year, e.g. from Namecheap or Cloudflare), point its A
record at the server's IP, and re-run the same command — it'll notice you
now have a domain and automatically get you a free HTTPS certificate via
Caddy. Do this before real passwords/data go in — until then, login posts
over plain HTTP.

**Redeploying after code changes:** re-run `bash deploy/setup-vps.sh` (or, if
already cloned, `cd /opt/crm && git pull && docker compose up -d --build`).
Your `.env` and database are untouched.

**Logs:** `cd /opt/crm && docker compose logs -f`

## Follow-up reminder emails (optional)

The in-app "Follow-ups" page is always accurate and needs no configuration.
To also send emails when a follow-up becomes due, set the `SMTP_*` variables
in `.env` and call `GET /api/cron/reminders` on a schedule (every 5–15
minutes), sending `Authorization: Bearer <CRON_SECRET>`. On the VPS setup
above, `deploy/setup-vps.sh` already schedules this call for you via
crontab — you only need to fill in `SMTP_*` in `.env` and restart
(`docker compose restart app`) to turn on the emails.

## Notes

- SQLite has no native enum support in Prisma, so roles/statuses/etc. are
  stored as plain strings; the allowed values live in
  `src/lib/constants.ts` and are enforced by the API layer with `zod`.
- `npm audit` currently reports one high-severity advisory in a `postcss`
  version bundled internally by Next.js itself (not a direct dependency of
  this project). It affects Next's own build-time CSS tooling, not runtime
  behavior of this app; re-run `npm audit` after upgrading Next.js to pick
  up the fix once it ships in a stable release.
