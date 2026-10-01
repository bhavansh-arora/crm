BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Awesome Event', NULL, '+918447716668', 'Event Planner, New Delhi. 62 reviews.'),
    ('Best Event Planner in Noida', NULL, '+918860049059', 'Event Planner, Greater Noida. 98 reviews.'),
    ('Weddingpur', NULL, '+917240687318', 'Wedding Photography, Patna. 408 reviews.'),
    ('Eventzgraph', NULL, '+919773795904', 'Event Planner, Mumbai. 401 reviews.'),
    ('Eventeds', NULL, '+917573815838', 'Event Management, Vadodara. 79 reviews.'),
    ('True Shades Photography', NULL, '+919920144211', 'Wedding Photography, Mumbai. 117 reviews.'),
    ('ADDY Events', NULL, '+919140058489', 'Event Planner, Greater Noida. 942 reviews.'),
    ('Sree Vikash Photography', NULL, '+919019617471', 'Wedding Photography, Bangalore. 69 reviews.'),
    ('MH12Weddings', NULL, '+918830989454', 'Wedding Photography, Pune. 387 reviews.')
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
