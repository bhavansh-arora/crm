BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Sumit Creation Pvt Ltd', 'Arving Agarwal — Owner', '+912612343349', 'Pvt Ltd, Surat. LinkedIn presence, no website listed.'),
    ('Techmantra Engineering Pvt Ltd', 'Rajinder Kumar — Owner', '+919212000543', 'Pvt Ltd, Gurugram. Facebook presence, no current website.'),
    ('Bharat Vyavasaya Pvt Ltd', 'Prashant Kumar — Owner', '+917456001161', 'Pvt Ltd, Agra. Facebook presence, no website listed.'),
    ('Chirmangal Furniture Pvt Ltd', 'Hemant Chitale — Owner', '+912024470142', 'Pvt Ltd, Pune. Facebook presence, no website listed.'),
    ('Auto CNC Machining Pvt Ltd', 'Aravind Mutgi — Owner', '+919886280911', 'Pvt Ltd, Bangalore. LinkedIn presence, no website listed.'),
    ('Aastha Intertrade Pvt Ltd', 'Viki V. Patel — Owner', '+919998026050', 'Pvt Ltd, Ahmedabad. Facebook + LinkedIn presence, no website listed.'),
    ('U V Garments Pvt Ltd', 'Nikhil Jain — Owner', '+919810651888', 'Pvt Ltd, Delhi. LinkedIn presence, no current website.'),
    ('Metaltech CNC Pvt Ltd', 'Bharat Patel — Owner', '+919825154195', 'Pvt Ltd, Chhatral, Gujarat. Facebook presence, no website listed.'),
    ('Lifeline Security Services Pvt Ltd', 'Sarvesh Malhotra — Owner', '+919569802954', 'Pvt Ltd, Chandigarh. Facebook presence, no website listed.'),
    ('UNITAS Environment Consultants LLP', 'Tina Solanki — Owner', '+919167920701', 'LLP, Mumbai. Facebook presence, no current website.'),
    ('Shriyai Architects & Interior Designers LLP', 'Akash Agrawal — Owner', '+919754722852', 'LLP, Khandwa. Facebook presence, no website listed.')
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
