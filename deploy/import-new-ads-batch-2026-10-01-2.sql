BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'New Ads', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, company, email, phone, note) AS (
  VALUES
    ('Fakur bannerjee', NULL, 'dramandit@lwda.com', '+916383494913', 'Budget: Rs 25,000-50,000. Timeline: within 7 days. (Instagram lead ad, English Solution Aware / Website Leads campaign)'),
    ('Dhruv Chourasia', 'Sarvixa', 'dhruvchourasia123@gmail.com', '+918989869656', 'Budget: around Rs 15,000. Timeline: within 7 days. (Instagram lead ad, English Solution Aware / Website Leads campaign)'),
    ('buildwithbishnu', NULL, 'bm796344@gmail.com', '+916206023792', 'Budget: around Rs 15,000. Timeline: within 7 days. (Instagram lead ad, English Solution Aware / Website Leads campaign)'),
    ('Deepak Pani Puri', NULL, 'mehroon@gmail.com', '+919381651690', 'Budget: Rs 25,000-50,000. Timeline: within 15-30 days. (Instagram lead ad, English Solution Aware / Website Leads campaign)'),
    ('gopal bhagat', NULL, 'sk6028963@gmail.com', '+918292233939', 'Budget: around Rs 15,000. Timeline: within 7 days. (Facebook lead ad, English Solution Aware / Website Leads campaign)'),
    ('Arpan Tamang', NULL, 'priyankayamang29@gmail.com', '+916296648779', 'Budget: around Rs 15,000. Timeline: within 7 days. (Instagram lead ad, English Solution Aware / Website Leads campaign)'),
    ('Sanjeev Gochapachi', 'Anagata', 'sanjeevcs0034@gmail.com', '+919026019566', 'Budget: around Rs 15,000. Timeline: within 15-30 days. (Instagram lead ad, English Solution Aware / Website Leads campaign)')
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
   = right(regexp_replace(il.phone, '\D', '', 'g'), 10)
ORDER BY s.name;

-- COMMIT; or ROLLBACK;
