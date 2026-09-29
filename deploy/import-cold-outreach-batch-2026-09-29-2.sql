BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Grace Caterers', NULL, '+919447458149', 'Catering, Kochi.'),
    ('Palasia Salon & Academy', 'Ruchita', '+919967908912', 'Salon/Academy, Mumbai.'),
    ('Dream Makerz', NULL, '+919878711782', 'Event Management/Wedding Planner, Panchkula.'),
    ('WingsCraft Entertainment', NULL, '+919664338087', 'Event Management/Wedding Planner, Mumbai.'),
    ('ZerOne Entertainment', NULL, '+919837183456', 'Event Management/Wedding Planner, Agra.'),
    ('Direct Celebrity Management', NULL, '+919555141310', 'Entertainment/Event Management, New Delhi.'),
    ('Neha Kachhara Interiors', NULL, '+912240901624', 'Interior Design, Mumbai.'),
    ('Empire Of Fitness', NULL, '+919990744404', 'Gym/Fitness, Gurgaon.'),
    ('Rb Gym&fitness Centre a/C', NULL, '+919390908590', 'Gym/Fitness, Tirupati.'),
    ('Spartans Gym', 'Siddharth Chaudhary', '+919871122906', 'Gym, Ghaziabad.'),
    ('Nitin''s Unisex Salon', NULL, '+919987791770', 'Salon, Thane.'),
    ('Pellipustakam Photography', 'G. Madhav', '+919966566630', 'Wedding Photography, Hyderabad.'),
    ('Guppy Weddings', NULL, '+919846571666', 'Wedding Photography, Alappuzha.'),
    ('Ravi''s Gym', 'A. V. Harish', '+919845856804', 'Gym, Bangalore.'),
    ('Dance Kala', 'Manisha Mehta', '+919342510474', 'Dance School, Bangalore.'),
    ('Muthu Catering Service', NULL, '+919345510406', 'Catering, Chidambaram.'),
    ('Krishna Tulsi Caterers', 'Esha Sidhu', '+919833019406', 'Catering, Mumbai.'),
    ('Sonam Beauty Parlour and Cosmetics', 'Mahendra Kalra', '+918800794465', 'Beauty Salon, Delhi.'),
    ('Architect', NULL, '+919915674482', 'Architecture/Engineering, Phagwara.'),
    ('Rockstar Dance Studio', NULL, '+919820528209', 'Dance School, Mumbai.'),
    ('F2F Unisex Gym', NULL, '+919711111472', 'Gym/Fitness, Faridabad.'),
    ('DMC Dance Studio', 'Pankaj Chauhan', '+917874025103', 'Dance School, Vadodara.'),
    ('Prapti Event Management', NULL, '+918754153650', 'Event Management, Pondicherry.'),
    ('A.K. Dance Academy', 'Ashish Kushwaha', '+918534098096', 'Dance School, Agra.'),
    ('Beauty Bells', 'Mishi Singh', '+919872108940', 'Beauty Salon/Spa, New Delhi.'),
    ('Architect and Interior Design, s', NULL, '+918529201011', 'Interior Design, Panipat.'),
    ('New Style Caterer & Decorator', NULL, '+919163095992', 'Catering/Decoration, Kolkata.'),
    ('Mind Circus Innovations Pvt. Ltd.', NULL, '+919561111045', 'Event Management, Pune.'),
    ('Atrias Photography Studio', NULL, '+919447309772', 'Wedding Photography, Kottayam.'),
    ('Naaz Photo Studio', 'Inndur Bhatia', '+919819222795', 'Wedding Photography, Mumbai.'),
    ('Keyur Soni Photography', NULL, '+917878570705', 'Wedding Photography, Vadodara.'),
    ('Nkphotographystudio', NULL, '+919662317678', 'Wedding Photography, Vadodara.'),
    ('Jems Evento', 'Rajiv Agarwal', '+919660212958', 'Wedding/Event Planning, Ajmer.'),
    ('Prakriti Ladies Beauty Salon & Spa', 'Prakriti Ji', '+919051918300', 'Salon/Spa, Kolkata.'),
    ('Face N Glow Beauty Parlour', 'Neeraj Gupta', '+919999516864', 'Beauty Salon, Delhi.'),
    ('Bonanza Beauty Lounge', NULL, '+919687288200', 'Beauty Salon, Visnagar.'),
    ('The Heaven Beauty Salon', 'Dipak', '+919712270020', 'Beauty Salon, Jamnagar.'),
    ('MaxBurn Gym N Fitness Club', NULL, '+919758474041', 'Gym/Fitness, Meerut.'),
    ('Gym Nation', NULL, '+918395951008', 'Gym/Fitness, Sirsa.'),
    ('The Core Unisex Gym', 'Rajesh Singh', '+919997079269', 'Gym/Fitness, Lucknow.')
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
SELECT il.id AS lead_id, s.name, s.phone
FROM inserted_leads il
JOIN source s
  ON right(regexp_replace(s.phone, '\D', '', 'g'), 10)
   = right(regexp_replace(il.phone, '\D', '', 'g'), 10)
ORDER BY s.name;

-- COMMIT; or ROLLBACK;
