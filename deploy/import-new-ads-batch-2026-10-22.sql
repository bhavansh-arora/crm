-- One-off import: 4 leads from the "New Ads" Facebook/Instagram lead-gen
-- campaign (2026-10-22 inbox pulls). Lead source "New Ads", assigned to
-- Tanmay (cmuasw8h9000vq5iwnpt9wjm5), status "NEW".
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

WITH source (name, phone, note) AS (
  VALUES
    ('Ankit bhai', '+919939369231', 'Budget: Rs 15,000-25,000 for the website. (Website Leads campaign)'),
    ('Narendra Jawalkar', '+918959012622', 'Budget: around Rs 15,000 for the website. (Website Leads campaign) Inbox: https://business.facebook.com/latest/2867931611727824?nav_ref=thread_view_by_psid'),
    ('Rahul Kumar Rahul Kumar', '+917643019274', 'Budget: around Rs 15,000 for the website. (Website Leads campaign)'),
    ('Parasnath Kushwahag', '+16283967155', 'Budget: around Rs 15,000 for the website. (Website Leads campaign) Inbox: https://business.facebook.com/latest/2981207537506736?nav_ref=thread_view_by_psid')
),
inserted_leads AS (
  INSERT INTO "Lead" (id, name, phone, source, status, "assignedToId", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, s.name, s.phone, 'New Ads', 'NEW', 'cmuasw8h9000vq5iwnpt9wjm5', now(), now()
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

-- Review the rows printed above -- should be up to 4 (fewer if any numbers
-- already exist in the CRM some other way). If it looks right:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;
