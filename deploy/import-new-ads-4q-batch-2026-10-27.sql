-- One-off import: 3 leads from the "Website Leads - 4 Questions" Facebook/
-- Instagram lead-gen form (2026-10-25 to 2026-10-27). Lead source
-- "New Ads", assigned to Anshu Jha (cmv9hu7tm0084w8mtm1r2uqut), status
-- "NEW". Industry, budget, timeline and existing-website answers are
-- recorded on each lead as a NOTE activity (no inbox URL this time, per
-- request). SojatiA is a repeat of the 2026-10-26 batch -- harmless either
-- way, the phone dedupe below skips it if it's already in.
--
-- Run INTERACTIVELY (not piped with -f/<) so you can review the rows it's
-- about to insert before committing:
--   docker compose exec postgres psql -U crm -d crm
-- Paste everything below down to (not including) the final comment, check
-- the rows it prints, then type COMMIT; or ROLLBACK; yourself.
--
-- Duplicate-safe: skips any row whose phone (normalized to its last 10
-- digits) already exists in the Lead table -- same rule the app itself uses.

BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'New Ads', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, email, phone, note) AS (
  VALUES
    ('SojatiA', 'hennabeauty@gmail.com', '+919413952303', 'Industry: Retail or e-commerce. Budget: around Rs 15,000. Timeline: within 1 month. Existing website: No, this will be my first website.'),
    ('Ritchie', 'Vk.ibamcsi@gmail.com', '+919716011110', 'Industry: Professional services. Budget: around Rs 15,000. Timeline: as soon as possible. Existing website: Yes, and it needs a redesign.'),
    ('Aklas Uddin', 'aklasuddin@gmail.com', '+919854320969', 'Industry: Retail or e-commerce. Budget: around Rs 15,000. Timeline: as soon as possible. Existing website: No, this will be my first website.')
),
inserted_leads AS (
  INSERT INTO "Lead" (id, name, email, phone, source, status, "assignedToId", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, s.name, s.email, s.phone, 'New Ads', 'NEW', 'cmv9hu7tm0084w8mtm1r2uqut', now(), now()
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
  SELECT gen_random_uuid()::text, il.id, 'cmv9hu7tm0084w8mtm1r2uqut', 'NOTE', s.note, now()
  FROM inserted_leads il
  JOIN source s
    ON right(regexp_replace(s.phone, '\D', '', 'g'), 10)
     = right(regexp_replace(il.phone, '\D', '', 'g'), 10)
  RETURNING "leadId"
)
SELECT il.id AS lead_id, il.name, il.phone
FROM inserted_leads il
ORDER BY il.name;

-- Review the rows printed above -- should be up to 3 (fewer if SojatiA was
-- already inserted on 2026-10-26). If it looks right:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;
