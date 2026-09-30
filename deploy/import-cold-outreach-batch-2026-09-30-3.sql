BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Acrehunt Real Estates Consultancy Pvt Ltd', NULL, '+919560567029', 'Real Estate Advisory, Gurugram, incorporated 2025 (Founder-led).'),
    ('MYSTARTUPWAVE Pvt Ltd', 'Amit Kumar Singh — Founder & CEO', '+917026191427', 'Software / Digital, Bengaluru, incorporated recently.'),
    ('Synfolix Pvt Ltd', 'V. Poojith Rao — Founder & CEO', '+917386429115', 'Healthcare Software, India, incorporated Aug 2025.'),
    ('ZILOXIS Pvt Ltd', NULL, '+919990193299', 'Real Estate / EV / Solar / IT, Ghaziabad, incorporated 2026 (Founder Direct).'),
    ('PZPL Pvt Ltd', 'Ashish Kumar Sinha — Founder & Director', '+917408851719', 'Hyperlocal Technology, Gorakhpur, incorporated 2025-26.'),
    ('IT Malar Pvt Ltd', 'Manoj — Founder', '+919629583169', 'IT Services, Aruppukottai, incorporated recently.'),
    ('Krystal7 Innovations Pvt Ltd', NULL, '+919465730130', 'Cross-Border Advisory, Gurugram, incorporated 2025 (Founder-led).'),
    ('ChitraYantra Technologies Pvt Ltd', 'Arindam Banik — Co-Founder & CEO', '+913335989323', 'AI / Hiring Technology, West Bengal, incorporated 2026.'),
    ('Asli One Global Pvt Ltd', 'Manoj Kannan — Founder & Director', '+918110908008', 'Software / Platform, Chengalpattu, incorporated Feb 2026.'),
    ('PANTERRA Pvt Ltd', 'Jitendra Singh — Founder & Director', '+919711069711', 'Technology / Engineering, Rajasthan, incorporated 2026.'),
    ('VANANTH AI (OPC) Pvt Ltd', 'Vedant Singhal — Founder & Director', '+917019853528', 'AI / SaaS, Bengaluru, incorporated 2026.'),
    ('Findour Services Pvt Ltd', 'Bhopal Singh — Founder & CEO', '+919519295529', 'IT / Digital Solutions, Kanpur, incorporated Mar 2025.'),
    ('iMerge Business Solutions Pvt Ltd', 'Anusha Govindarajan — Founder & CEO', '+917338865530', 'AI / Technology, Chennai, incorporated 2025-26.'),
    ('Givni Pvt Ltd', 'Suraj Pandit — Founder & CEO', '+919835942411', 'IT / Digital Marketing, Patna, incorporated 2025.'),
    ('StartupKaro Pvt Ltd', NULL, '+917890000088', 'Startup Services / Technology, Mohali, incorporated 2026 (Founder-led).')
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
