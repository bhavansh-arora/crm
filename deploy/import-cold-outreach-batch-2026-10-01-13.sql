BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Saffron Sun Security Solution Pvt Ltd', 'Malkiyat Singh — Owner', '+919417665991', 'Pvt Ltd, Barnala, Punjab. Facebook presence, no website listed.'),
    ('Kapoor Abhushan Palace Pvt Ltd', 'Mohit Kapoor — Owner', '+919818808629', 'Pvt Ltd, Delhi. Facebook presence, no website listed.'),
    ('Maverick Resorts Pvt Ltd', NULL, '+911164555511', 'Pvt Ltd, Delhi. Facebook presence, no website listed.'),
    ('Konna Chit Funds Pvt Ltd', NULL, '+918942226693', 'Pvt Ltd, Srikakulam, AP. Facebook presence, no website listed.'),
    ('Avatarluxe Aestheticians Pvt Ltd', NULL, '+919884469279', 'Pvt Ltd, Bangalore. Facebook/Instagram presence, no website listed.'),
    ('AD Taken Pvt Ltd', NULL, '+917071996666', 'Pvt Ltd, Kochi. No website listed.'),
    ('Affable Web Solution Pvt Ltd', NULL, '+917428105345', 'Pvt Ltd, Gurugram. No website listed.'),
    ('Merakii Brandpro Pvt Ltd', NULL, '+918595121426', 'Pvt Ltd, Ghaziabad. No website listed.'),
    ('DLK Technologies Pvt Ltd', NULL, '+919344899473', 'Pvt Ltd, Chennai. No website listed.')
),
inserted_leads AS (
  INSERT INTO "Lead" (id, name, "contactName", phone, source, status, "assignedToId", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, s.name, s."contactName", s.phone, 'Cold Outreach', 'NEW', 'cmuasw8h9000vq5iwnpt9wjm5', now(), now()
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
SELECT il.id AS lead_id, s.name, s."contactName", s.phone, s.note
FROM inserted_leads il
JOIN source s
  ON right(regexp_replace(s.phone, '\D', '', 'g'), 10)
   = right(regexp_replace(il.phone, '\D', '', 'g'), 10)
ORDER BY s.name;

-- COMMIT; or ROLLBACK;
