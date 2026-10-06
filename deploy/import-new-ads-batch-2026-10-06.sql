BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'New Ads', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, company, email, phone, note) AS (
  VALUES
    ('Shunil', 'Sunil Jha Haus Hotel and kitana Setor', 'akb886202@gmail.com', '+919608041319', 'Budget: around Rs 15,000. Timeline: in the next 7 days. (Instagram lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Shiv Dayal Raturi', 'M/S Shivdayalraturi', 'shivdayalraturi.sr@gmail.com', '+919760140233', 'Budget: Rs 25,000-50,000. Timeline: just thinking about it for now. (Instagram lead ad, Hindi Social Page / Website Leads campaign)')
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
