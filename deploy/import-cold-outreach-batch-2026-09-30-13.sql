BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Arihant Events', 'Krunal Mehta — Owner', '+919867931320', 'Events, Dombivli.'),
    ('Balloon Basket', 'Pragati Mor — Owner', '+919823466611', 'Events/Decoration, Nagpur.'),
    ('Shree Vandana Caterers', 'Lalit Solanki — Owner', '+919322305834', 'Catering/Event, Mumbai.'),
    ('GALA Caterers', 'Vaibhav Kumar — Owner', '+919839156550', 'Catering, Uttar Pradesh.'),
    ('Arth Agam Design Studio', 'Subharagini — Owner', '+919994153531', 'Architect / Design, Coimbatore.'),
    ('Design Studio Architect', 'Akshat Saxena — Owner', '+919935364665', 'Architect, Lucknow.'),
    ('Preet Caterers', 'Ishan Gandhi — Owner', '+919925312371', 'Catering, Vadodara.'),
    ('Kaizad Patel Caterers', 'Kaizad Patel — Chef/Owner', '+919820200133', 'Catering, Mumbai.'),
    ('Natu Caterers', 'Vaibhav Natu — Owner', '+919860595903', 'Catering, Nashik.'),
    ('Parth Party Plot', 'Jignesh Patel — Owner', '+919898818283', 'Event Venue, Ahmedabad.')
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
