BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Ravishing Dudez Unisex Saloon', 'Murali Srinatha — Owner', '+919743499591', 'Salon/Spa, Bangalore.'),
    ('Life Style Salon', 'Anita Malik — Owner', '+919555966653', 'Salon, Sonipat.'),
    ('New Affinity Unisex Salon', 'Tarun Kumar Potra — Owner', '+919988084601', 'Salon, Amritsar.'),
    ('Fab21 Beauty Salon', 'Chaitali Dasai — Owner', '+918140552067', 'Salon, Surat.'),
    ('Fabulooks Ladies Salon & Spa', 'Mohit Jaiswal — Owner', '+918981010884', 'Salon/Spa, Kolkata.'),
    ('Unlock Store', 'Divya Ramamurthy — Founder', '+919742122791', 'Retail/Lifestyle, Bangalore.')
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
