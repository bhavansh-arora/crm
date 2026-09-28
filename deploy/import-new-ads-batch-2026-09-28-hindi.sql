-- One-off import: 1 lead from a Facebook "Website Leads" campaign (same
-- campaign as import-new-ads-batch-2026-09-28.sql, c:120249265353480498 --
-- this one's the Hindi-language ad/form variant). Same lead source
-- "New Ads", assigned to Tanmay (cmuasw8h9000vq5iwnpt9wjm5), status "NEW"
-- (uncontacted). Business name goes in Lead.company; budget/timeline are
-- attached as a NOTE activity, since there's no dedicated column for them.
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
VALUES (gen_random_uuid()::text, 'New Ads', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, company, email, phone, note) AS (
  VALUES
    (
      'Jagnaryan Singh',
      'Career Plan Internet Media Pvt Ltd',
      'jagnarayansingh111972@gmail.com',
      '+919386399714',
      'Budget: Rs 25,000-50,000. Timeline: next 1-3 months. (Facebook lead ad, Hindi Social Page / Website Leads campaign)'
    )
),
inserted_leads AS (
  INSERT INTO "Lead" (id, name, company, email, phone, source, status, "assignedToId", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, s.name, s.company, s.email, s.phone, 'New Ads', 'NEW', 'cmuasw8h9000vq5iwnpt9wjm5', now(), now()
  FROM source s
  WHERE NOT EXISTS (
    SELECT 1 FROM "Lead" l
    WHERE l.phone IS NOT NULL
      AND right(regexp_replace(l.phone, '\D', '', 'g'), 10)
        = right(regexp_replace(s.phone, '\D', '', 'g'), 10)
  )
  RETURNING id, phone
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
SELECT il.id AS lead_id, s.name, s.company, s.phone, s.note
FROM inserted_leads il
JOIN source s
  ON right(regexp_replace(s.phone, '\D', '', 'g'), 10)
   = right(regexp_replace(il.phone, '\D', '', 'g'), 10);

-- Review the row printed above -- should be exactly 1 (or 0 if this phone
-- already exists in the CRM some other way). If it looks right:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;
