BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'New Ads', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, company, email, phone, note) AS (
  VALUES
    ('mivaan parde wala', 'Mivaan parde wala cinema choke katangi mp', 'vijaythakre984@gmail.com', '+919039489779', 'Budget: around Rs 15,000. Timeline: just thinking about it for now. (Facebook/Instagram lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Anidealman Ideal', 'jyotish', 'anidealmani5@gmail.com', '+919928454222', 'Budget: Rs 15,000-25,000. Timeline: just thinking about it for now. (Facebook lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Vijaykumar Babrewla', NULL, 'bijukumarb919@gmail.com', '+917597133231', 'Budget: Rs 15,000-25,000. Timeline: in the next 7 days. (Facebook lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Sanjeev Gochapachi', 'Anagata', 'sanjeevcs0034@gmail.com', '+919026019566', 'Budget: around Rs 15,000. Timeline: within 15-30 days. (Facebook/Instagram lead ad, English Solution Aware / Website Leads campaign)')
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

-- COMMIT; or ROLLBACK;
