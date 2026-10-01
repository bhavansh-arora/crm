BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Mukesh Singh Photography', 'Mukesh Singh — Owner', '+919937632761', 'Photography. Facebook presence, no website listed.'),
    ('Akarshana Events', 'Kiran — Owner', '+919949218172', 'Events. Facebook presence, no website listed.'),
    ('Prestige Events N Decor', 'Shafiulla Baig — Owner', '+919739295515', 'Events/Decor, Bangalore. Facebook presence, no website listed.'),
    ('J D Decor', 'Pramod Dhawan — Owner', '+919451510210', 'Interior Decoration (flooring, wallpapers, sofas). Instagram presence, no website listed.'),
    ('Ruhi Designs', 'Ruhi Amaliyar — Owner', '+919879410309', 'Interior Design. Facebook presence, no website listed.'),
    ('Vishwas Photography', NULL, '+919845598190', 'Wedding Photography, Mysore. Facebook presence, no website listed.'),
    ('Isaak Interior Design', 'Isaak Tochhawng — Owner', '+918729825238', 'Interior Design. Instagram presence, no website listed.')
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
