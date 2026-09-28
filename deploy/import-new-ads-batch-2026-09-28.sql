-- One-off import: 3 leads from a Facebook/Instagram "Website Leads" export
-- (English Solution Aware / Open Targeting / English High Intent form).
-- New lead source "New Ads", assigned to Tanmay (cmuasw8h9000vq5iwnpt9wjm5),
-- left at the default status "NEW" (uncontacted). Budget/timeline from the
-- form are attached as a NOTE activity on each lead, since there's no
-- dedicated column for them on Lead.
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
    ('Fakur bannerjee', 'dramandit@lwda.com', '+916383494913', 'Budget: Rs 25,000-50,000. Timeline: within 7 days. (Facebook/Instagram lead ad, English Solution Aware / Website Leads campaign)'),
    ('Dhruv', 'dhruvchourasia123@gmail.com', '+918989869656', 'Budget: around Rs 15,000. Timeline: within 7 days. (Facebook/Instagram lead ad, English Solution Aware / Website Leads campaign)'),
    ('buildwithbishnu', 'bm796344@gmail.com', '+916206023792', 'Budget: around Rs 15,000. Timeline: within 7 days. (Facebook/Instagram lead ad, English Solution Aware / Website Leads campaign)')
),
inserted_leads AS (
  INSERT INTO "Lead" (id, name, email, phone, source, status, "assignedToId", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, s.name, s.email, s.phone, 'New Ads', 'NEW', 'cmuasw8h9000vq5iwnpt9wjm5', now(), now()
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
SELECT il.id AS lead_id, s.name, s.phone, s.note
FROM inserted_leads il
JOIN source s
  ON right(regexp_replace(s.phone, '\D', '', 'g'), 10)
   = right(regexp_replace(il.phone, '\D', '', 'g'), 10);

-- Review the rows printed above -- should be all 3 (or fewer, if any
-- already snuck in some other way), each with its budget/timeline note.
-- If it looks right:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;
