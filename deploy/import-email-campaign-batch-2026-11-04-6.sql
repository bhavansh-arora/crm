-- One-off import: 1 lead from an email outreach conversation that's gone
-- well -- she and her manager liked the preview, got a $699 quote
-- (bilingual FR/EN site), call offered. Lead source "Email Campaign",
-- assigned to Shugofta (cmuf554b7007iixqkmf2wi80u), status "NEGOTIATION",
-- temperature "HOT". website is our preview (carolest-pierre.codebunny.net),
-- not her own site, matching the established convention.
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
    ('Carole St-Pierre', 'Carole St-Pierre Salon & Spa', 'carole@carolest-pierre.com', '+15142465607', 'https://carolest-pierre.codebunny.net/', 'Cold email to Carole St-Pierre Salon & Spa (hair/spa/wedding styling, Vaudreuil-Dorion, QC). Carole and her manager liked the preview. Quoted $699 USD on 3 Nov for a bilingual French/English site and offered a call this week to go through it -- no reply since.')
),
inserted_leads AS (
  INSERT INTO "Lead" (id, name, company, email, phone, website, source, status, temperature, "assignedToId", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, s.name, s.company, s.email, s.phone, s.website, 'Email Campaign', 'NEGOTIATION', 'HOT', 'cmuf554b7007iixqkmf2wi80u', now(), now()
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
