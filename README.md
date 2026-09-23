# CRM

A simple, mobile-friendly CRM for managing leads, sales reps, and follow-ups.

## Stack

- Next.js 15 (App Router) + TypeScript
- Prisma + Postgres
- NextAuth (credentials login, JWT sessions, role-based access)
- Tailwind CSS

## Features

- **Admin panel**: create leads, create/deactivate/delete sales reps, assign
  leads to reps, reassign at any time. Deleting a user is blocked while they
  still have leads assigned (reassign those first), and you can't delete
  your own account or the last remaining admin.
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
- **Admin dashboard**: revenue won, pipeline value, warm pipeline (pitched
  amount on Warm leads), conversion rate, average deal size, average time to
  close, pipeline-by-stage funnel with average time spent in each stage,
  temperature breakdown, revenue/conversion per sales rep, and today's new
  leads/due follow-ups.
- **Lead temperature**: reps mark each lead Hot/Warm/Cold; filter and sort
  leads by it, and see it as a badge everywhere.
- **Amount pitched**: reps can update the deal value they've pitched
  directly on the lead; Warm leads with a pitched amount roll up into the
  Warm Pipeline stat.
- **Leads list filtering**: quick chips for Due Today / Overdue / Status
  Stale (no status change in 3+ days), plus sort by value, time in stage, or
  lead source. The Dialer has the same Due Today / Overdue / Status Stale
  chips and a lead-source filter, so a rep can work through just their
  overdue calls or just one campaign's leads.
- **Admin-managed lead sources**: a Sources page to add/retire the list
  reps pick from when a lead is created — no more free-text typos.
- **Team activity monitoring**: see who's online right now (a lightweight
  heartbeat ping), when each rep was last active, and how many status
  changes/notes/calls they've logged — with an automatic warning if leads
  are being updated at a suspiciously fast pace (e.g. several status
  changes within the same minute). A **Time Tracking** tab on the same page
  breaks this down per day per rep — total time the app was open, split
  into sessions with start/end timestamps (e.g. "9:02 AM – 11:47 AM"). This
  measures time the CRM was open and in the foreground, not time on the
  phone or doing other work away from the screen, so it's a useful estimate
  rather than an exact timesheet.
- **Payment links (optional, needs Razorpay keys)**: generate a Razorpay
  payment link from any lead, share it, and see whether it's been paid —
  updated automatically via webhook, or on demand with "Check status".
- **External lead ingestion (optional)**: `POST /api/external/leads`, gated
  by an `EXTERNAL_LEADS_SECRET` bearer token, lets another internal tool
  push leads straight in — used by the companion Leads Finder tool's
  "Push to CRM" button. Dedupes by phone number (a lead already in the
  system under that phone is skipped, not duplicated) and auto-creates the
  named source if it doesn't already exist as a Lead Source. A matching
  `GET /api/external/sources` lists current source names, so the pushing
  tool can offer a picker instead of a fixed, hardcoded source.
- **One-touch calling**: a Call button on every lead dials out via the
  device's phone app (`tel:` link — works great on mobile, needs a
  softphone on desktop). A dedicated Dialer page turns this into a queue:
  call the lead on top, log the outcome and an optional follow-up, and it
  automatically advances to the next one.
- **WhatsApp templates**: write reusable message templates (with a
  `{{name}}` placeholder filled in from the lead's contact name), then send
  one to any lead's number in one click — opens WhatsApp with the message
  pre-filled, ready to send. Attach an image straight from your device (no
  need to host it yourself first — it's uploaded to the app's own server
  and the link is generated automatically) and it shows up as a preview
  thumbnail under the message. Any plain URL typed into the message becomes
  a tappable link automatically. Real tappable Quick Reply buttons aren't
  possible this way — that needs the paid, Meta-approved WhatsApp Business
  API, not the free `wa.me` link this feature sends through.
- **Browser notifications**: opt in once, then get a real desktop
  notification the moment a follow-up becomes due, for as long as the app
  is open — no email setup required.
- **Role-based access**: admins see everything; sales reps only see and act
  on leads assigned to them, and can't reach admin pages.
- Responsive layout with a mobile bottom tab bar and a desktop top nav.
- Currency shown throughout as ₹ (INR).

## Getting started

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL (a Postgres connection
                           # string — see the comment in .env.example for a
                           # one-line local Docker Postgres, or just use a
                           # free Neon database), NEXTAUTH_SECRET (any
                           # random string), and the seed admin credentials
npm run db:migrate        # applies the schema (also seeds an initial admin user)
npm run dev
```

Visit http://localhost:3000 and log in with the seed admin credentials from
`.env` (defaults: `admin@example.com` / `ChangeMe123!` — change the password
after first login by editing the user, or create additional admins from the
Team page).

From the Team page (as an admin) you can add sales reps, who log in with the
email/password you set for them.

## Deploying to Vercel + Neon (free, fastest, no ID verification)

Best option when you need this live quickly — sign-up is just email/GitHub,
no KYC/ID verification on either service. Cost: $0/month at this scale.
Trade-off: the free Neon database auto-suspends after ~5 minutes idle, so
the very first request after a quiet spell takes an extra 0.5-2s to wake
back up — not noticeable in daily use.

**1. Create a free Neon Postgres database** at neon.tech (sign in with
GitHub or email, no card required). Create a project, then copy its
connection string from the dashboard (starts with `postgresql://`).

**2. Create a free Vercel account** at vercel.com (sign in with GitHub —
this also lets it see your repos). Click **Add New → Project**, and import
`bhavansh-arora/crm`, selecting the `claude/crm-admin-lead-management-2dea2w`
branch.

**3. Before clicking Deploy**, add these Environment Variables in the
import screen (Settings → Environment Variables works too, if you've
already deployed once):

| Name | Value |
|---|---|
| `DATABASE_URL` | the Neon connection string from step 1 |
| `NEXTAUTH_SECRET` | any random string — generate one with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | your Vercel URL, e.g. `https://crm-yourname.vercel.app` (Vercel shows this after first deploy — add it, then redeploy once) |
| `SEED_ADMIN_EMAIL` | the email your team's admin will log in with |
| `SEED_ADMIN_PASSWORD` | a temporary password (change it after first login) |
| `CRON_SECRET` | any random string — Vercel automatically sends it to `/api/cron/reminders` on the schedule in `vercel.json` |

**4. Click Deploy.** Vercel detects the `vercel-build` script in
`package.json`, which runs migrations and creates the admin account
automatically as part of the build — no separate step needed. When it
finishes, open the URL it gives you and log in.

**Giving employees access tomorrow:** once you're logged in as admin, go to
the Team page and add a sales-rep account for each employee (their own
email + a temporary password); each one logs in at the same URL.

**Redeploying after code changes:** push to the branch, or click Redeploy
in the Vercel dashboard — migrations and the admin check re-run safely
every time (they no-op if there's nothing new to do).

**Moving to the VPS later:** once your VPS's KYC clears, you can point it
at this exact same Neon database (paste the same connection string into
`deploy/setup-vps.sh` when it asks) — no data migration, no re-entering
leads.

## Deploying to a VPS (once KYC clears, ~$4-6/month, no cold starts)

This gets the app onto a small always-on server you control.

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
Your `.env`, `Caddyfile`, and database are untouched — `Caddyfile` is
git-ignored on purpose (see `Caddyfile.example`) so redeploying can never
wipe out your domain/HTTPS config.

**Logs:** `cd /opt/crm && docker compose logs -f`

## Follow-up reminder emails (optional)

The in-app "Follow-ups" page is always accurate and needs no configuration.
To also send emails when a follow-up becomes due, set the `SMTP_*`
variables and redeploy/restart:

- **On Vercel**, `vercel.json` already schedules a daily call to
  `/api/cron/reminders` via Vercel Cron (Vercel's free Hobby plan limits
  cron jobs to once per day — fine as a daily digest of what's due; upgrade
  to Pro for hourly/minute-level scheduling).
- **On the VPS**, `deploy/setup-vps.sh` already schedules this call every
  10 minutes via crontab.

Either way, just fill in `SMTP_*` — nothing else to wire up.

## Payment links (optional, Razorpay)

Lets reps generate a payment link straight from a lead and see whether it's
been paid. Disabled by default (leads simply show no "Request payment"
result and an error saying it isn't set up).

1. Get your **Key ID** and **Key Secret** from Razorpay Dashboard → Settings
   → API Keys. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. (Recommended) In Razorpay Dashboard → Settings → Webhooks, add a webhook
   pointing at `https://yourdomain.com/api/webhooks/razorpay` with the
   **payment_link.paid** event enabled, and set `RAZORPAY_WEBHOOK_SECRET` to
   the same secret you enter there. This makes "Paid" show up automatically,
   in real time.
3. Without step 2, payment status only updates when someone clicks the
   "Check status" button on the lead — still correct, just not automatic.
4. The moment a payment is confirmed paid (via the webhook, or "Check
   status"), a receipt email goes out automatically to the rep who
   generated the link and to every admin, with the amount, lead, and
   payment link — reusing the same `SMTP_*` settings as follow-up reminder
   emails. If `SMTP_HOST` isn't set, this is skipped (logged, not an error).

Redeploy/restart after setting these.

## Notes

- Roles/statuses/etc. are stored as plain strings rather than Postgres
  native enums (kept simple rather than reworked after an earlier SQLite
  version of this schema); the allowed values live in
  `src/lib/constants.ts` and are enforced by the API layer with `zod`.
- `npm audit` currently reports one high-severity advisory in a `postcss`
  version bundled internally by Next.js itself (not a direct dependency of
  this project). It affects Next's own build-time CSS tooling, not runtime
  behavior of this app; re-run `npm audit` after upgrading Next.js to pick
  up the fix once it ships in a stable release.
