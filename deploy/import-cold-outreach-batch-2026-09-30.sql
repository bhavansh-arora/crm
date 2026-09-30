BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Asli One Global Private Limited', 'Manoj Kannan — Founder & Director', '+918110908008', 'Software / platform services, Chengalpattu, Tamil Nadu.'),
    ('PANTERRA PRIVATE LIMITED', 'Jitendra Singh — Founder & Director', '+919711069711', 'Real Estate, Sikar, Rajasthan.'),
    ('Design Studio Architect', 'Akshat Saxena — Owner', '+919935364665', 'Architect, Lucknow.'),
    ('Arth Agam Design Studio', 'Subharagini — Owner', '+919994153531', 'Architect / Design, Coimbatore.'),
    ('SPADES – Architects + Interiors + Landscape', 'Karthik — Architect', '+919052525251', 'Architecture / Interior, Hyderabad.'),
    ('Bennywing Interior Designer', NULL, '+919003208146', 'Interior Design, Chennai.'),
    ('Kuldeep Patil Architect', NULL, '+918390336727', 'Architecture, Thane/Virar.'),
    ('Pramod Jain Architect', 'Mamta Jain — Coordinator', '+911126362193', 'Architecture, Delhi.'),
    ('A One Modular Kitchen Pawan Jangid', 'Satish Ram', '+919024932970', 'Modular Kitchen, Jaipur.'),
    ('Sakshi Modular Kitchen & Interior', NULL, '+915624064149', 'Modular Kitchen / Interior, Agra.'),
    ('Accurate Modular Kitchen', 'Bhagyesh Naik — Manager', '+919637617563', 'Modular Kitchen, Virar.'),
    ('Modular Kitchen', NULL, '+919549658581', 'Interior / Modular Kitchen, Udaipur.'),
    ('Furniture – Modular Kitchen', NULL, '+918925133670', 'Furniture / Modular Kitchen, Chennai.'),
    ('RS Riddhi Siddhi Civil Construction & Interior Designer', 'Sanjay Shroff', '+917666396396', 'Construction / Interior, Ulhasnagar.'),
    ('Kushal Photography', NULL, '+919916821000', 'Wedding Photography, Bangalore.'),
    ('Pellipustakam Photography', 'G. Madhav', '+919966566630', 'Wedding Photography, Hyderabad.'),
    ('Moments Photography', NULL, '+919677205413', 'Wedding Photography, Chennai.'),
    ('Wedding Spree', 'Jineet Nolkha', '+917976486682', 'Wedding Planner, Bhilwara.'),
    ('The Azad Wedding and Event Planner', NULL, '+919888257857', 'Wedding / Events, Chandigarh/Zirakpur.'),
    ('Aiming High Events', 'Payal Jaiswal — Proprietor', '+919836384412', 'Event Management, Kolkata.'),
    ('Expert Event Management', NULL, '+918856050007', 'Event Management, Solapur.'),
    ('Zodiac Events Management & Decorations', NULL, '+918088053234', 'Event Management, Bangalore.'),
    ('Aura Event Planners', NULL, '+918197463366', 'Wedding / Events, Bangalore.'),
    ('Shubh Events', NULL, '+919892772266', 'Event Management, Mumbai.'),
    ('Direct Celebrity Management', NULL, '+919555141310', 'Entertainment / Events, Delhi.'),
    ('ZerOne Entertainment', NULL, '+919837183456', 'Events / Wedding Planning, Agra.')
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
