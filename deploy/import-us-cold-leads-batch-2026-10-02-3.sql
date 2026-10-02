BEGIN;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('All In One General Contracting & Home Improvements LLC', 'Kenneth R. Crumb — Owner', '+17407519189', 'Roofing / Remodeling, Richwood, OH.'),
    ('Franklin Mechanical Services LLC', 'Stephen P. Franklin — Owner', '+16142644649', 'HVAC / Refrigeration, Pickerington, OH.'),
    ('E-Tech LLC', 'Michelle R. Busch — President/Owner', '+17406371622', 'Electrical / HVAC, Chillicothe, OH.'),
    ('Stars Home Remodeling, Inc.', 'Ahmad K. Shalabi — Owner', '+16149723995', 'Roofing / Remodeling, Hilliard, OH.'),
    ('Foltz Contracting LLC', 'Joshua Foltz — Owner/Partner', '+17404075708', 'Roofing / Remodeling / Concrete, Lancaster, OH.'),
    ('4TS Investments LLC', 'Trevor Simpson — Owner', '+12083154877', 'General Contractor / Tile, Nampa, ID.'),
    ('Outdoor Property Services LLC', 'Thomas E. Blackburn — Owner', '+16148598993', 'Roofing / Landscaping / Fencing, Worthington, OH.')
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
