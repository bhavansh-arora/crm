-- One-off import: 3 leads from the "Website Leads - 4 Questions" Facebook/
-- Instagram lead-gen form (indian_Leads.xlsx export, 2026-10-25/26). Lead
-- source "New Ads", assigned to Anshu Jha (cmv9hu7tm0084w8mtm1r2uqut),
-- status "NEW". Industry, budget, timeline and existing-website answers are
-- recorded on each lead as a NOTE activity, since the schema has no
-- dedicated columns for them.
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
    ('Surendar Kumar', 'surendar843316@gmail.com', '+919801723622', 'Industry: Retail or e-commerce. Budget: above Rs 50,000. Timeline: in 1 to 3 months. Existing website: Yes, and it needs a redesign. Inbox: https://business.facebook.com/latest/40414609441459308?nav_ref=thread_view_by_psid'),
    ('Kanchan Singh', 'kumardhiraj33678@gmail.com', '+919142481496', 'Industry: Retail or e-commerce. Budget: Rs 15,000-25,000. Timeline: in 1 to 3 months. Existing website: Yes, and it needs a redesign. Inbox: https://business.facebook.com/latest/1417630246745040?nav_ref=thread_view_by_igsid'),
    ('SojatiA', 'hennabeauty@gmail.com', '+919413952303', 'Industry: Retail or e-commerce. Budget: around Rs 15,000. Timeline: within 1 month. Existing website: No, this will be my first website. Inbox: https://business.facebook.com/latest/29700581026240093?nav_ref=thread_view_by_psid')
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

-- Review the rows printed above -- should be up to 3. If it looks right:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;
