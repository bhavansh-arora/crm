-- One-off import: 1 lead from an email outreach conversation. Lead source
-- "Email Campaign", assigned to Shugofta (cmuf554b7007iixqkmf2wi80u),
-- status "NEW". website is our preview (dancecart.codebunny.net), not her
-- own WordPress site, matching the established convention.
--
-- Run INTERACTIVELY (not piped with -f/<) so you can review the row it's
-- about to insert before committing:
--   docker compose exec postgres psql -U crm -d crm
-- Paste everything below down to (not including) the final comment, check
-- the row it prints, then type COMMIT; or ROLLBACK; yourself.
--
-- Duplicate-safe: skips if the phone (normalized to its last 10 digits)
-- already exists in the Lead table -- same rule the app itself uses.

BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Email Campaign', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, company, email, phone, website, note) AS (
  VALUES
    ('Amy Kirwan', 'Dance Cart', 'amy@dancecart.com.au', '+61438739709', 'https://dancecart.codebunny.net/', 'Cold email to Dance Cart (curriculum-aligned school dance programs). Amy (Director) is reviewing and simplifying her WordPress site, so the timing was good. Asked how a course catalogue/enrolment/payment system would work with her site, plus company info, past work and costs. Sent a preview and answers on 4 Nov -- no reply yet.')
),
inserted_leads AS (
  INSERT INTO "Lead" (id, name, company, email, phone, website, source, status, "assignedToId", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, s.name, s.company, s.email, s.phone, s.website, 'Email Campaign', 'NEW', 'cmuf554b7007iixqkmf2wi80u', now(), now()
  FROM source s
  WHERE NOT EXISTS (
    SELECT 1 FROM "Lead" l
    WHERE l.phone IS NOT NULL
      AND right(regexp_replace(l.phone, '\D', '', 'g'), 10)
        = right(regexp_replace(s.phone, '\D', '', 'g'), 10)
  )
  RETURNING id, name, phone
),
inserted_activities AS (
  INSERT INTO "Activity" (id, "leadId", "userId", type, note, "createdAt")
  SELECT gen_random_uuid()::text, il.id, 'cmuf554b7007iixqkmf2wi80u', 'NOTE', s.note, now()
  FROM inserted_leads il
  JOIN source s
    ON right(regexp_replace(s.phone, '\D', '', 'g'), 10)
     = right(regexp_replace(il.phone, '\D', '', 'g'), 10)
  RETURNING "leadId"
)
SELECT il.id AS lead_id, il.name, il.phone
FROM inserted_leads il;

-- Review the row printed above -- should be 1. If it looks right:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;
