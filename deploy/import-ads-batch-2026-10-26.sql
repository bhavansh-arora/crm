-- One-off import: 20 leads from the "Website Leads - 3 Questions" Facebook/
-- Instagram lead-gen form (indian_Leads.xlsx export, 2026-10-22 to 2026-10-26).
-- Only this form's sheet -- the sibling "Website Leads - 4 Questions" sheet
-- in the same workbook is deliberately excluded. Lead source "Ads", assigned
-- to Tanmay (cmuasw8h9000vq5iwnpt9wjm5), status "NEW".
--
-- Run INTERACTIVELY (not piped with -f/<) so you can review the rows it's
-- about to insert before committing:
--   docker compose exec postgres psql -U crm -d crm
-- Paste everything below down to (not including) the final comment, check
-- the rows it prints, then type COMMIT; or ROLLBACK; yourself.
--
-- Duplicate-safe: skips any row whose phone (normalized to its last 10
-- digits) already exists in the Lead table -- same rule the app itself uses.
-- 4 of these 20 (Ankit bhai, Narendra Jawalkar, Rahul Kumar Rahul Kumar,
-- Parasnath Kushwahag) are expected to be skipped as duplicates of the
-- 2026-10-22 New Ads batch.

BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Ads', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, phone, note) AS (
  VALUES
    ('सरयुग शर्मा विकास शर्मा', '+918294700440', 'Budget: around Rs 15,000 for the website. Inbox: https://business.facebook.com/latest/29391062507247183?nav_ref=thread_view_by_psid'),
    ('Kyvhh', '+919075291118', 'Budget: around Rs 15,000 for the website. Inbox: https://business.facebook.com/latest/1475624314669582?nav_ref=thread_view_by_igsid'),
    ('Sita Hembrom', '+918099279452', 'Budget: around Rs 15,000 for the website. Inbox: https://business.facebook.com/latest/28966108166349815?nav_ref=thread_view_by_psid'),
    ('Shyam Sundar', '+919572504162', 'Budget: Rs 25,000-50,000 for the website. Inbox: https://business.facebook.com/latest/28546053188430065?nav_ref=thread_view_by_psid'),
    ('Satyam Gii', '+918088884814', 'Budget: Rs 15,000-25,000 for the website. Inbox: https://business.facebook.com/latest/28517764331239829?nav_ref=thread_view_by_psid'),
    ('nraspersderye', '+918890411578', 'Budget: around Rs 15,000 for the website. Inbox: https://business.facebook.com/latest/29279957481599909?nav_ref=thread_view_by_psid'),
    ('Chotu Kumar', '+918877016585', 'Budget: around Rs 15,000 for the website. Inbox: https://business.facebook.com/latest/29312985308339646?nav_ref=thread_view_by_psid'),
    ('Him Kur', '+919801385985', 'Budget: Rs 25,000-50,000 for the website. Inbox: https://business.facebook.com/latest/39590293023918785?nav_ref=thread_view_by_psid'),
    ('Dharkumar', '+918603196207', 'Budget: Rs 15,000-25,000 for the website. Inbox: https://business.facebook.com/latest/28734473226194174?nav_ref=thread_view_by_psid'),
    ('Paulinai Hebmrom', '+917033958744', 'Budget: Rs 25,000-50,000 for the website. Inbox: https://business.facebook.com/latest/28790290073954398?nav_ref=thread_view_by_psid'),
    ('Gouri Sankar Raju', '+919154870781', 'Budget: around Rs 15,000 for the website. Inbox: https://business.facebook.com/latest/39381942731420299?nav_ref=thread_view_by_psid'),
    ('Šanĝ Pûi', '+917085941264', 'Budget: around Rs 15,000 for the website. Inbox: https://business.facebook.com/latest/28782296871429843?nav_ref=thread_view_by_psid'),
    ('Pushpendra Singh Shekhawat Pushpendra', '+919664392636', 'Budget: around Rs 15,000 for the website.'),
    ('Sunil Kumar', '+918088552627', 'Budget: around Rs 15,000 for the website. High Intent. Inbox: https://business.facebook.com/latest/1847179833104196?nav_ref=thread_view_by_igsid'),
    ('Amoghspatil', '+918971139718', 'Budget: Rs 15,000-25,000 for the website. High Intent. Inbox: https://business.facebook.com/latest/935956142675152?nav_ref=thread_view_by_igsid'),
    ('Kanak Singh Singh', '+919369943846', 'Budget: Rs 15,000-25,000 for the website. Inbox: https://business.facebook.com/latest/28587576367577642?nav_ref=thread_view_by_psid'),
    ('Parasnath Kushwahag', '+916283967155', 'Budget: around Rs 15,000 for the website. Inbox: https://business.facebook.com/latest/29812075375061736?nav_ref=thread_view_by_psid'),
    ('Narendra Jawalkar', '+918959012622', 'Budget: around Rs 15,000 for the website. Inbox: https://business.facebook.com/latest/28679316011727824?nav_ref=thread_view_by_psid'),
    ('Ankit bhai', '+919939369231', 'Budget: Rs 15,000-25,000 for the website. High Intent. Inbox: https://business.facebook.com/latest/1427828785398549?nav_ref=thread_view_by_psid'),
    ('Rahul Kumar Rahul Kumar', '+917643019274', 'Budget: around Rs 15,000 for the website. High Intent. Inbox: https://business.facebook.com/latest/1979203929417837?nav_ref=thread_view_by_igsid')
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

-- Review the rows printed above -- should be up to 20 (likely ~16, since 4
-- are expected duplicates of the 2026-10-22 New Ads batch). If it looks right:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;
