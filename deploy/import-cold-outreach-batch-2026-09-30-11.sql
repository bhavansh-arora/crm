BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('India Photo Studio', 'Vimal Thakar', '+912224112393', 'Photography, Mumbai.'),
    ('Ander''s Photo Framing & Portrait Studio', 'Shyju M. George', '+919447202107', 'Photography/Studio, Palakkad.'),
    ('Studio Radhika', 'Giri Dhar', '+919849290415', 'Photography Studio, Kakinada.'),
    ('Subhamm Digital', 'Sanjay Sharma', '+919811007840', 'Photography / Camera Studio, New Delhi.'),
    ('Vertex Digital Studio', 'Partha Shah', '+919831076489', 'Photography Studio, Uttarpara, WB.'),
    ('Suchitra Digital Studio', 'Sanjib Kumar Jena', '+919861314162', 'Photography Studio, Balasore, Odisha.'),
    ('Studio Red 21', 'Krishan Kataria', '+919812534422', 'Photography Studio, Karnal.'),
    ('Preet Studio', 'Gurmeet Singh', '+919896131050', 'Wedding Photography, Karnal.'),
    ('Click Art Photo Studio', 'Kishor Bhai', '+919825931125', 'Photography, Surat.'),
    ('Chameleon Events & Promotions', 'Ritesh', '+919804447025', 'Events & Promotions, Kolkata.'),
    ('Foto Magic Wedding Studio', 'Benny Joesuph', '+919447720913', 'Wedding Photography, Thodupuzha, Kerala.'),
    ('Shree Hari Fashion Studio', 'Akash Navadiya', '+919601291363', 'Fashion/Photography Studio, Surat.'),
    ('VaibhaV Studio & Colour Lab', 'Sreenivas Madduri', '+919849353500', 'Photography Studio, Kadapa.'),
    ('My Dreams Studio', 'Krishna Kumar', '+919840278782', 'Wedding Photography, Chennai.'),
    ('Suri Photo''s', 'Shivam Suri', '+919415218012', 'Photography, Prayagraj.'),
    ('Uthayam Studio', 'G. Suburayan', '+919789399846', 'Photography Studio, Kovilpatti, Tamil Nadu.')
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
