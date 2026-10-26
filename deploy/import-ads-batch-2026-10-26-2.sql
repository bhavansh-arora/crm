-- Follow-up to import-ads-batch-2026-10-26.sql: 2 more leads from the
-- "Website Leads - 3 Questions" form that appeared after that batch ran.
-- Lead source "Ads", assigned to Tanmay (cmuasw8h9000vq5iwnpt9wjm5),
-- status "NEW".
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

WITH source (name, phone, note) AS (
  VALUES
    ('Montu Mura', '+919181840792', 'Budget: around Rs 15,000 for the website.'),
    ('Riya Sarder', '+919635811335', 'Budget: Rs 25,000-50,000 for the website.')
),
inserted_leads AS (
  INSERT INTO "Lead" (id, name, phone, source, status, "assignedToId", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, s.name, s.phone, 'Ads', 'NEW', 'cmuasw8h9000vq5iwnpt9wjm5', now(), now()
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
  SELECT gen_random_uuid()::text, il.id, 'cmuasw8h9000vq5iwnpt9wjm5', 'NOTE', s.note, now()
  FROM inserted_leads il
  JOIN source s
    ON right(regexp_replace(s.phone, '\D', '', 'g'), 10)
     = right(regexp_replace(il.phone, '\D', '', 'g'), 10)
  RETURNING "leadId"
)
SELECT il.id AS lead_id, il.name, il.phone
FROM inserted_leads il
ORDER BY il.name;

-- Review the rows printed above -- should be 2. If it looks right:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;
