BEGIN;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Three Brothers Roofing', 'Alexander Solano', '+13802798420', 'Roofing. Found via Better Business Bureau.'),
    ('Top Dawg General Contracting', 'Traven Sabo', '+16144843469', 'General Contracting. Found via Better Business Bureau.'),
    ('Shield Pro Roofing', 'Tyler Link', '+17404033236', 'Roofing. Found via Shield Pro Roofing''s own website.'),
    ('Purvis Excavating', 'Klay Purvis', '+17402251195', 'Excavating. Found via Better Business Bureau.'),
    ('Duffey Exteriors', 'Zalen Duffey', '+16147018504', 'Exteriors. Found via Better Business Bureau.'),
    ('Henkle Electric', 'Donald Henkle', '+17404269770', 'Electric. Found via Better Business Bureau.'),
    ('Q & Son''s Hauling & Towing', 'Quincy Hale', '+16149008254', 'Hauling & Towing. Found via Better Business Bureau.'),
    ('Top Roofing & Windows', 'Joseph Michael', '+16145308082', 'Roofing & Windows.')
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
