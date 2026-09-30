BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Anand Park Family Saloon & Spa', 'Anand — Owner', '+919940434188', 'Salon/Spa, Chennai.'),
    ('Nakalang Events', 'Bhupesh Prajapati — Director & Owner', '+919426063544', 'Event Management, Ahmedabad.'),
    ('Mathur Studio', 'Vishal Mathur — Owner', '+919927260272', 'Wedding Photography, Meerut.'),
    ('Geometry Interior Designer', 'Nayan Shah — Owner', '+919099885583', 'Interior Design, Surat.'),
    ('Absolute Events And Brand Promotion', 'Rahim Khan — Owner', '+919893949560', 'Event Management, Bhopal.'),
    ('Subhamm Digital', 'Sanjay Sharma — Owner', '+919811007840', 'Photography / Camera Studio, Delhi.'),
    ('Suvarna Beauty Clinic & Spa', 'Sunanda Maharana — Owner', '+919595903059', 'Beauty/Spa, Solapur.'),
    ('Fedora Interior Pvt. Ltd.', 'Sumit Agarwal — Owner', '+919748336346', 'Interior Design, Kolkata.'),
    ('Passionate', 'Gaurav Joshi — Owner', '+918601215393', 'Interior Design, Odisha.'),
    ('Prakriti Ladies Beauty Salon & Spa', 'Prakriti Ji — Owner', '+919051918300', 'Salon/Spa, Kolkata.')
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
