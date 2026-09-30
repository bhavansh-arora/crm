BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Lovely Hair Dressing Hall', 'Tahir Shaikh — Owner', '+912226354290', 'Salon, Mumbai.'),
    ('Beauty World Salon', 'Anjali Samangaonkar — Owner', '+919822091427', 'Salon/Beauty, Chhatrapati Sambhajinagar.'),
    ('Divine Spa & Salon', 'Sam — Owner', '+918427184272', 'Salon/Spa, Ludhiana.'),
    ('Budget Beauty Salon', 'Ritesh Patil — Owner', '+919326286828', 'Salon, Navi Mumbai.'),
    ('Fab Future Interior', 'Deepa Advani — Owner', '+919909328059', 'Interior Design, Ahmedabad.'),
    ('Manthan Media Pvt Ltd', 'Ravish Puri — Owner', '+919897529575', 'Event Management, Roorkee.'),
    ('Milonelion Interior Design', 'Haridas Nerkar — Owner', '+919420786600', 'Interior Design, Pune.'),
    ('MUSCLE NATION Gym & Boxing', 'Dinesh Kumar — Owner', '+919884689022', 'Gym/Fitness, Chennai.'),
    ('JGS Fitness Centre', 'Shalini Bharghava — Owner', '+919324246680', 'Gym/Fitness, Mumbai.'),
    ('Fitness First', 'Srinivasan — Owner', '+919566079794', 'Gym/Fitness, Chennai.'),
    ('S.poison Dance Studio', 'Shivaji Badaole — Owner', '+919586080780', 'Dance School, Ankleshwar.'),
    ('Rock On Dance Studio', 'Sam Rajput — Owner', '+919904438528', 'Dance/Performing Arts, Surat.'),
    ('Preet Studio', 'Gurmeet Singh — Owner', '+919896131050', 'Wedding Photography, Karnal.'),
    ('P2k Creations Enterprises', 'Kailash Chandra Swain — Owner', '+918033767255', 'Interior/Architect, Delhi.'),
    ('Conearchs Architect Planners & Interiors', 'Amit Dhage — Owner', '+919890838785', 'Architecture/Interior, Nagpur.'),
    ('Mohan Baug', 'Hims Pat — Owner', '+919321118391', 'Wedding Venue, Virar.'),
    ('Hindustan Green Nursery', 'Anjaneyulu Patamsetti — Owner', '+919052199012', 'Landscape/Nursery, Kadiam, AP.'),
    ('Interior Designing', NULL, '+919417423238', 'Interior Design, Ludhiana.'),
    ('Example Interiors Pvt Ltd', NULL, '+919892418633', 'Interior Design, Navi Mumbai.')
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
