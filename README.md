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

## Follow-up reminder emails (optional)

The in-app "Follow-ups" page is always accurate and needs no configuration.
To also send emails when a follow-up becomes due, set the `SMTP_*` variables
in `.env` and call `GET /api/cron/reminders` on a schedule (every 5–15
minutes) from your platform's scheduler (Vercel Cron, a GitHub Action, plain
cron + curl, etc.), sending `Authorization: Bearer <CRON_SECRET>`.

## Notes

- SQLite has no native enum support in Prisma, so roles/statuses/etc. are
  stored as plain strings; the allowed values live in
  `src/lib/constants.ts` and are enforced by the API layer with `zod`.
- `npm audit` currently reports one high-severity advisory in a `postcss`
  version bundled internally by Next.js itself (not a direct dependency of
  this project). It affects Next's own build-time CSS tooling, not runtime
  behavior of this app; re-run `npm audit` after upgrading Next.js to pick
  up the fix once it ships in a stable release.
