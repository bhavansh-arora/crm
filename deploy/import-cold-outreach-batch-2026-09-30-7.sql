BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Sparo Events', 'Tamil Selvan — Owner', '+918608448392', 'Event Management, Chennai.'),
    ('Intercraft Interior Designer', 'Vikram Bundela — Owner', '+919889192742', 'Interior Design, Uttar Pradesh.'),
    ('Mukesh Singh Photography', 'Mukesh Singh — Owner', '+919937632761', 'Photography, Rourkela.'),
    ('DM Photography', 'Dharambir Mohanty — Owner', '+919090408686', 'Photography, Bhubaneswar.'),
    ('Ander''s Photo Framing & Portrait Studio', 'Shyju M. George — Owner', '+919447202107', 'Photography/Studio, Palakkad.'),
    ('Studio Radhika', 'Giri Dhar — Owner', '+919849290415', 'Photography Studio, Kakinada.'),
    ('Prem Makude Photography', 'Kuldeep Joshi — Owner', '+918983144371', 'Wedding Photography, Chhatrapati Sambhajinagar.')
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
