BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, email, phone, website) AS (
  VALUES
    ('Gleaming Media - Digital SEO Marketing Agency India', 'info@gleamingmedia.com', '+918920679902', 'https://www.gleamingmedia.com/'),
    ('E4k digital agency, India', 'websupport@e4k.co', '+917960656365', 'http://www.e4k.co/'),
    ('Js Textile India Pvt Ltd', 'info@moheydesi.com', '+919971575801', 'http://www.moheydesi.com/'),
    ('Vionsys IT Solutions India Pvt Ltd', 'info@vionsys.com', '+913322872075', 'https://www.vionsys.com/'),
    ('The Red Canvas Interiors', NULL, '+917566617921', 'https://www.facebook.com/interiordesignersukhvindersinghvirdigwaliorcity')
),
inserted_leads AS (
  INSERT INTO "Lead" (id, name, email, phone, website, source, status, "assignedToId", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, s.name, s.email, s.phone, s.website, 'Cold Outreach', 'NEW', 'cmuasw8h9000vq5iwnpt9wjm5', now(), now()
  FROM source s
  WHERE s.phone IS NULL OR NOT EXISTS (
    SELECT 1 FROM "Lead" l
    WHERE l.phone IS NOT NULL
      AND right(regexp_replace(l.phone, '\D', '', 'g'), 10)
        = right(regexp_replace(s.phone, '\D', '', 'g'), 10)
  )
  RETURNING id, name, phone
)
SELECT * FROM inserted_leads;

-- COMMIT; or ROLLBACK;
