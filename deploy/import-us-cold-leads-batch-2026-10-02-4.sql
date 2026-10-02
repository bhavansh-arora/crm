BEGIN;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('B&R Exteriors LLC', 'Billy Colwell — Owner', '+17408150771', 'Roofing / Remodeling, Marengo, OH.'),
    ('The Heating and Cooling Pro LLC', 'Carl Sliwinski — Owner', '+16145601747', 'HVAC, Lewis Center, OH.'),
    ('R J Howard Electric LLC', 'Richard J. Howard — Owner', '+16147787544', 'Electrical, Upper Arlington, OH.'),
    ('Bryant Renovations LLC', 'Andrew Bryant — Owner', '+17407046813', 'Remodeling / Decks, Zanesville, OH.'),
    ('Ohio REI & Contracting', 'Shellil Yohannes — Co-Owner', '+16149629020', 'Remodeling / Roofing, Columbus, OH.'),
    ('Kyros Development Group LLC', 'William Taylor — Owner', '+16147474096', 'General Contractor / Remodeling, New Albany, OH.'),
    ('E-Tech LLC', 'Michelle R. Busch — President/Owner', '+17406371622', 'Electrical / HVAC, Chillicothe, OH.'),
    ('Hepburn Renovations', 'John Hepburn — Owner', '+16144960827', 'Remodeling / Plumbing, Columbus, OH.'),
    ('A1 Heating & Cooling, Plumbing LLC', 'Brad J. Welker — Owner', '+17404541998', 'HVAC / Plumbing, Zanesville, OH.'),
    ('All In One General Contracting & Home Improvements LLC', 'Kenneth R. Crumb — Owner', '+17407519189', 'Roofing / Remodeling, Richwood, OH.')
),
inserted_leads AS (
  INSERT INTO "Lead" (id, name, "contactName", phone, source, status, "assignedToId", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, s.name, s."contactName", s.phone, 'US Cold Leads', 'NEW',
    (SELECT id FROM "User" WHERE email = 'shugofta2002@gmail.com'), now(), now()
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
  SELECT gen_random_uuid()::text, il.id, (SELECT id FROM "User" WHERE email = 'shugofta2002@gmail.com'), 'NOTE', s.note, now()
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
