BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Creative Concept Interior', 'Nikhil Jain — Owner', '+919691266276', 'Interior design, Sagar, MP.'),
    ('Nawab Interior Decorators', 'Deepak Gill — Owner', '+919873332303', 'Interior/decor, Delhi.'),
    ('Sai Chakra Caterers', 'Harish Shetty — Owner', '+919833257680', 'Catering + wedding services, Navi Mumbai.'),
    ('Hindustan Green Nursery', 'Anjaneyulu Patamsetti — Owner', '+919052199012', 'Nursery + landscaping, Kadiam, AP.'),
    ('Sri Vasavi Catering Service', 'Pradeep — Owner', '+919087942599', 'Catering, Hosur.'),
    ('Conearchs Architect Planners & Interiors', 'Amit Dhage — Owner', '+919890838785', 'Architecture + interiors, Nagpur.'),
    ('Aruna Studio', 'Satish Limmana — Owner', '+919949815656', 'Photography + events, Hyderabad.'),
    ('KALA – A Piece of Art', 'Meenu Goyal — Owner', '+919850899047', 'Interior design, Pune.'),
    ('Bhushan Chakote Architect & Interior Designer', 'Bhushan Chakote — Owner', '+912025440651', 'Architecture + interiors, Pune.'),
    ('Milonelion Interior Design', 'Haridas Nerkar — Owner', '+919420786600', 'Interior design, Pune.'),
    ('A&I Digest – Amit Danait', 'Amit Danait — Owner', '+919604789789', 'Interior design, Pune.'),
    ('Pretty Woman Beauty Salon & Academy', 'Seahadri Vasan — Owner', '+918023610712', 'Salon + academy, Bangalore.'),
    ('AM Interior', 'Manoj Ghode — Owner', '+918767116163', 'Interior design, Pune.'),
    ('Atulya Patwardhan Architects & Interior Designer', 'Atulya Patwardhan — Owner', '+912064004323', 'Architecture + interiors, Pune.'),
    ('Pandhi Decorators', 'Ravinder Singh — Owner', '+911124603247', 'Decor + catering + events, New Delhi.'),
    ('Jai Maa Ambe Furniture & Interior', 'Chotelal Sharma — Owner', '+919323351631', 'Furniture + interiors, Thane.')
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
