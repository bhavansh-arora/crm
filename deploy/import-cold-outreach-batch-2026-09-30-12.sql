BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('P2K Creations Enterprises', 'Kailash Chandra Swain — Owner', '+918033767255', 'Interior/Architect, Delhi.'),
    ('Arcon Architects, Interior Designers', 'Ravneet Pal Singh — Owner', '+918054327056', 'Architecture/Interior, Patiala.'),
    ('Harsha Salon & Beauty Spa', 'Adil — Owner', '+917039009292', 'Salon, Mumbai.'),
    ('Panchsheel Hair Dresser & Beauty Parlour', 'Viral Parekh — Owner', '+919428880502', 'Salon, Vadodara.'),
    ('Chameleon Events & Promotions', 'Ritesh — Owner', '+919804447025', 'Events & Promotions, Kolkata.'),
    ('Manthan Media Pvt Ltd', 'Ravish Puri — Owner', '+919897529575', 'Event Management, Roorkee.'),
    ('India Photo Studio', NULL, '+912224112393', 'Photography, Mumbai.'),
    ('Studio Red 21', 'Krishan Kataria — Owner', '+919812534422', 'Photography Studio, Karnal.'),
    ('Suchitra Digital Studio', 'Sanjib Kumar Jena', '+919861314162', 'Photography Studio, Balasore.'),
    ('Vertex Digital Studio', 'Partha Shah', '+919831076489', 'Photography Studio, Uttarpara, West Bengal.'),
    ('VaibhaV Studio & Colour Lab', 'Sreenivas Madduri', '+919849353500', 'Photography Studio, Kadapa.'),
    ('My Dreams Studio', 'Krishna Kumar', '+919840278782', 'Wedding Photography, Chennai.'),
    ('Suri Photo''s', 'Shivam Suri', '+919415218012', 'Photography, Prayagraj.'),
    ('Uthayam Studio', 'G. Suburayan', '+919789399846', 'Photography Studio, Kovilpatti.'),
    ('Sharada Photo Studio', NULL, '+919848193171', 'Photography Studio, Hanamkonda.'),
    ('Event Solution India', NULL, '+918004444889', 'Event Management, Kanpur.')
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
