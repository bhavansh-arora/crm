BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'New Ads', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, company, email, phone, note) AS (
  VALUES
    ('Harishchandra Mishra', NULL, 'harishchandramishra7700@gmail.com', '+917700505472', 'Budget: Rs 25,000-50,000. Timeline: in the next 7 days. (Facebook lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Ramcharan', 'chilli', 'Ramchansbr2025@gmail.com', '+919140320373', 'Budget: around Rs 15,000. Timeline: in the next 7 days. (Facebook lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Satish Saraf', 'YouTube channel / Singer', 'sateeshsaraf75095@gmail.com', '+919300362154', 'Budget: around Rs 15,000. Timeline: in the next 7 days. (Facebook lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Sushila devi', 'Ganpati Genral store', 'rathoreramsaran40@gmail.com', '+918868075752', 'Budget: Rs 25,000-50,000. Timeline: in the next 7 days. (Instagram lead ad, Hindi Social Page / Website Leads campaign)'),
    ('tiktikjobs', 'tiktikjobs', 'tiktikjobs@gmail.com', '+917984486836', 'Budget: around Rs 15,000. Timeline: in the next 7 days. (Instagram lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Hitesh Kumar', 'Jaimatadi tour and Tarver only driver services', 'Jaimatadihitesh1@gmail.com', '+919971184407', 'Budget: Rs 25,000-50,000. Timeline: in the next 7 days. (Facebook lead ad, Hindi Social Page / Website Leads campaign)'),
    ('Premrajmeena Meena', NULL, 'premrajmawra07568235679@gmail.com', '+919571587104', 'Budget: Rs 25,000-50,000. Timeline: in the next 7 days. (Instagram lead ad, Hindi Social Page / Website Leads campaign)')
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
