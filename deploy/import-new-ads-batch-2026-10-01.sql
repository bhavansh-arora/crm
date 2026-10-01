BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'New Ads', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, company, email, phone, note) AS (
  VALUES
    ('Jagnaryan Singh', 'Career Plan Internet Media Pvt Ltd', 'jagnarayansingh111972@gmail.com', '+919386399714', 'Budget: Rs 25,000-50,000. Timeline: in the next 1-3 months. (Facebook lead ad, Hindi Social Page / Website Leads campaign)'),
    ('mivaan parde wala', 'Mivaan parde wala cinema choke katangi mp', 'vijaythakre984@gmail.com', '+919039489779', 'Budget: around Rs 15,000. Timeline: just thinking about it for now. (Instagram lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Anidealman Ideal', 'jyotish', 'anidealmani5@gmail.com', '+919928454222', 'Budget: Rs 15,000-25,000. Timeline: just thinking about it for now. (Facebook lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Vijaykumar Babrewla', NULL, 'bijukumarb919@gmail.com', '+917597133231', 'Budget: Rs 15,000-25,000. Timeline: in the next 7 days. (Facebook lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Siddesh Yadav', '24x7 Horse Electric Work and Home Maintenance Service', 'yadavsiddhesh423@gmail.com', '+917303590015', 'Budget: around Rs 15,000. Timeline: in the next 15-30 days. (Instagram lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Sarthak trunk house Krrish furniture mart', 'Krrish furniture Sarthak tank house', 'amitvijavat@gmail.com', '+919424323509', 'Budget: around Rs 15,000. Timeline: in the next 15-30 days. (Instagram lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Cute_Cute_Love_boy', 'Roop General Store', 'pankajjainldh2@gmail.com', '+918427360987', 'Budget: Rs 15,000-25,000. Timeline: in the next 1-3 months. (Instagram lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Deepak Kumar', NULL, 'dk18877774393@gmail.com', '+917018444072', 'Budget: Rs 15,000-25,000. Timeline: in the next 7 days. (Facebook lead ad, Hindi Social Page / Website Leads campaign)'),
    ('mansi wamanjawelleys and Sadie business vikareta', 'Sadie business jewellery', 'aajundahatodedahatode@gmail.com', '+919579368242', 'Budget: around Rs 15,000. Timeline: just thinking about it for now. (Instagram lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Shree Ram Traders', 'shri ram traders', 'sharma.shriram278@gmail.com', '+917080262688', 'Budget: around Rs 15,000. Timeline: in the next 7 days. (Facebook lead ad, Hindi Social Page / Website Leads campaign)'),
    ('mahant ji', NULL, 'pandeyvedanshu52@emali.com', '+918726764180', 'Budget: around Rs 15,000. Timeline: in the next 7 days. (Instagram lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Yogesh Kumar', 'AC servicing and repairing', 'ykumar82533@gmail.com', '+917408636044', 'Budget: around Rs 15,000. Timeline: in the next 7 days. (Facebook lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Nirogam Healthcare Centre, Raipur (CG)', 'Nirogam Healthcare Center', 'drmsbotherwork@gmail.com', '+919300793431', 'Budget: around Rs 15,000. Timeline: in the next 1-3 months. (Facebook lead ad, Hindi Social Page / Website Leads campaign)'),
    ('बाबा श्याम वाटर प्रूफ बिल्डिंग मकान स्कूल', 'Jay shree shyam watar proofing and Hit profig', 'vinodbarod580@gmail.com', '+917909783808', 'Budget: Rs 25,000-50,000. Timeline: just thinking about it for now. (Instagram lead ad, Hindi Social Page / Website Leads campaign)')
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
