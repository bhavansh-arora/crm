BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('GMB Caterers', 'Vikas Sharma', '+919328134533', 'Catering, Ahmedabad.'),
    ('Diya Interiors', 'Arun Sharma', '+919892239320', 'Interior Design, Bangalore.'),
    ('Manthan Media Pvt Ltd', 'Ravish Puri', '+919897529575', 'Event Management, Roorkee.'),
    ('Geometry Interior Designer', 'Nayan Shah', '+919099885583', 'Interior Design, Surat.'),
    ('Beauty World Salon', 'Anjali Samangaonkar', '+919822091427', 'Salon/Beauty, Chhatrapati Sambhajinagar.'),
    ('Date Caterers', 'Heramb', '+919873994929', 'Catering, Dhule.'),
    ('India Photo Studio', 'Vimal Thakar', '+912224112393', 'Photography, Mumbai.'),
    ('Studio Red 21', 'Krishan Kataria', '+919812534422', 'Photography Studio, Karnal.'),
    ('Suchitra Digital Studio', 'Sanjib Kumar Jena', '+919861314162', 'Photography Studio, Balasore.'),
    ('Vertex Digital Studio', 'Partha Shah', '+919831076489', 'Photography Studio, Uttarpara, WB.'),
    ('VaibhaV Studio & Colour Lab', 'Sreenivas Madduri', '+919849353500', 'Photography Studio, Kadapa.'),
    ('My Dreams Studio', 'Krishna Kumar', '+919840278782', 'Wedding Photography, Chennai.')
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
