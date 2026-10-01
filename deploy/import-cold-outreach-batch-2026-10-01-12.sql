BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Arunabh Technotronics LLP', 'Satya Prakash Tiwari — Designated Partner / Tanushri Satya Prakash Tiwari — Partner', '+917096908133', 'LLP, Bhopal. No website listed.'),
    ('Falcon Ebiz Pvt Ltd', NULL, '+919167789464', 'Pvt Ltd, Thane. Business number found; website needs verification.'),
    ('Nixies India Technologies LLP', NULL, '+918462006255', 'LLP, Bhopal. Website needs verification.'),
    ('Sudarsini Solutions LLP', NULL, '+914047095035', 'LLP, Hyderabad. Website needs verification.')
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
