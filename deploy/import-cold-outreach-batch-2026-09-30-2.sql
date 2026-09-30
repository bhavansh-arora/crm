BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Asli One Global Pvt Ltd', 'Manoj Kannan — Founder & Director', '+918110908008', 'Pvt Ltd company, incorporated Feb 2026, Chengalpattu.'),
    ('Myntrix Labs Pvt Ltd', 'Yogesh Sahu — Founder', '+918085573004', 'Pvt Ltd company, incorporated 2026, Vidisha.'),
    ('ChitraYantra Technologies Pvt Ltd', 'Arindam Banik — Co-Founder & CEO', '+913335989323', 'Pvt Ltd company, incorporated 2026, West Bengal.'),
    ('Rixroent Pvt Ltd', 'Somesh Sharma — Founder & CEO', '+919262609224', 'Pvt Ltd company, incorporated Jan 2026, Bihar.'),
    ('Sabhahith Works Pvt Ltd', 'Nagaraja Sabhahith — Founder', '+917019392625', 'Pvt Ltd company, incorporated 2026, Karnataka.'),
    ('Swasthy Health Technologies Pvt Ltd', 'Ashwin Kumar — Founder & Director', '+919092044331', 'Pvt Ltd company, incorporated 2026, Coimbatore.'),
    ('Transformed Arrogyam Pvt Ltd', 'Dr. Atantra Das Gupta — Co-Founder & CEO', '+919971490042', 'Pvt Ltd company, incorporated Mar 2026, New Delhi.'),
    ('Jayashri Solar Energy Pvt Ltd', 'Aditya Dnyaneshwar Gurav — Co-Founder & Director', '+912268976194', 'Pvt Ltd company, incorporated 2026, Maharashtra.'),
    ('PANTERRA Pvt Ltd', 'Jitendra Singh — Founder & Director', '+919711069711', 'Pvt Ltd company, incorporated 2026, Rajasthan.'),
    ('VANANTH AI (OPC) Pvt Ltd', 'Vedant Singhal — Founder & Director', '+917019853528', 'Pvt Ltd company, incorporated 2026, Bangalore.'),
    ('ARVA GROUPS Pvt Ltd', 'Madhavi — Director', '+917760643705', 'Pvt Ltd company, incorporated May 2026, Anekal, Karnataka.'),
    ('Hastin Beverages Pvt Ltd', 'Lokesh M Patel — Founder & MD', '+919662018825', 'Pvt Ltd company, incorporated 2025, Vadodara.'),
    ('Appsira Innovation Pvt Ltd', 'Shankar Ram — Managing Director', '+918905848734', 'Pvt Ltd company, incorporated 2025, Jaipur.'),
    ('Findour Services Pvt Ltd', 'Bhopal Singh — Founder & CEO', '+919519295529', 'Pvt Ltd company, incorporated Mar 2025, Kanpur.'),
    ('Donkm Tech Pvt Ltd', 'Laxmi Maharana — CEO', '+918209754017', 'Pvt Ltd company, incorporated 2025, Noida.')
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
