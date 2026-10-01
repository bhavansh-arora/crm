BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Smartway India Enterprises LLP', 'Ashok — Managing Director', '+919423574381', 'LLP, Coimbatore. Facebook presence, no current website.'),
    ('DezignCrafters LLP', 'Cyril Kuriakose', '+919820520541', 'LLP, Mumbai. Facebook presence, no website listed.'),
    ('Reliable Exchange House (India) Pvt Ltd', 'Sushant Desai — Owner', '+919689507349', 'Pvt Ltd, Dombivli. Facebook presence, no current website.'),
    ('KSH Agro Foods Bangalore Pvt Ltd', 'Sharath — Owner', '+918904050564', 'Pvt Ltd, Raichur. Facebook presence, no current website.'),
    ('Almas Biotech Pvt Ltd', 'Pradeep Porwal — Owner', '+919412183076', 'Pvt Ltd, Bharthana, UP. Facebook presence, no current website.'),
    ('Oren Hydrocarbons Pvt Ltd', 'Saravanan — Owner', '+917350325936', 'Pvt Ltd, Chennai. Facebook presence, no current website.'),
    ('Metaltech CNC Pvt Ltd', 'Bharat Patel — Owner', '+919825154195', 'Pvt Ltd, Chhatral, Gujarat. Facebook presence, no current website.')
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
