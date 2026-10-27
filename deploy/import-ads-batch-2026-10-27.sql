-- One-off import: 7 leads from the "Website Leads - 3 Questions" form
-- (2026-10-26/27). Lead source "Ads", assigned to Anshu Jha
-- (cmv9hu7tm0084w8mtm1r2uqut), status "NEW". No inbox URL in notes, per
-- request. Riya Sarder is a repeat of the 2026-10-26 batch (assigned to
-- Tanmay then) -- the dedupe below will skip her, not reassign her.
--
-- Run INTERACTIVELY (not piped with -f/<) so you can review the rows it's
-- about to insert before committing:
--   docker compose exec postgres psql -U crm -d crm
-- Paste everything below down to (not including) the final comment, check
-- the rows it prints, then type COMMIT; or ROLLBACK; yourself.
--
-- Duplicate-safe: skips any row whose phone (normalized to its last 10
-- digits) already exists in the Lead table -- same rule the app itself uses.

BEGIN;

WITH source (name, phone, note) AS (
  VALUES
    ('Riya Sarder', '+919635811335', 'Budget: Rs 25,000-50,000 for the website.'),
    ('Binud Tanti', '+918099778540', 'Budget: around Rs 15,000 for the website.'),
    ('Rajesh Bhihari 112', '+917033272225', 'Budget: Rs 25,000-50,000 for the website.'),
    ('Sanjay Chauhan', '+919140269076', 'Budget: Rs 15,000-25,000 for the website.'),
    ('Chandra MoniRajkhowa', '+919365598889', 'Budget: Rs 25,000-50,000 for the website.'),
    ('Senrela Hemrom', '+917488446460', 'Budget: Rs 25,000-50,000 for the website.'),
    ('Tapan Roy', '+919239085422', 'Budget: around Rs 15,000 for the website.')
),
inserted_leads AS (
  INSERT INTO "Lead" (id, name, phone, source, status, "assignedToId", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, s.name, s.phone, 'Ads', 'NEW', 'cmv9hu7tm0084w8mtm1r2uqut', now(), now()
  FROM source s
  WHERE NOT EXISTS (
    SELECT 1 FROM "Lead" l
    WHERE l.phone IS NOT NULL
      AND right(regexp_replace(l.phone, '\D', '', 'g'), 10)
        = right(regexp_replace(s.phone, '\D', '', 'g'), 10)
  )
  RETURNING id, name, phone
),
inserted_activities AS (
  INSERT INTO "Activity" (id, "leadId", "userId", type, note, "createdAt")
  SELECT gen_random_uuid()::text, il.id, 'cmv9hu7tm0084w8mtm1r2uqut', 'NOTE', s.note, now()
  FROM inserted_leads il
  JOIN source s
    ON right(regexp_replace(s.phone, '\D', '', 'g'), 10)
     = right(regexp_replace(il.phone, '\D', '', 'g'), 10)
  RETURNING "leadId"
)
SELECT il.id AS lead_id, il.name, il.phone
FROM inserted_leads il
ORDER BY il.name;

-- Review the rows printed above -- should be up to 7 (6 if Riya Sarder was
-- already inserted on 2026-10-26). If it looks right:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;
