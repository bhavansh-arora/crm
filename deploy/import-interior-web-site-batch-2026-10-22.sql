-- One-off import: 15 leads from the "Interior Web Site" Facebook/Instagram
-- lead-gen campaign (2026-10-20 to 2026-10-21 export). Lead source
-- "Interior Web Site", assigned to Tanmay (cmuasw8h9000vq5iwnpt9wjm5),
-- status "NEW".
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

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Interior Web Site', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, email, phone) AS (
  VALUES
    ('Jaykesh Jangli', 'jjaykeshkumar03@gmail.com', '+916201637494'),
    ('Sarita Yadav', 'sy8602169@gmail.com', '+917905360299'),
    ('jaykee Kumar sah', 'jaykeekumarj@gmail.com', '+917061100170'),
    ('S Kumar', 'sohank50369@gmail.com', '+919793009510'),
    ('Raj Raj Randhir', 'rajrandhir8851@gmail.com', '+918851295784'),
    ('Md Nasar Khan', 'md123456nasar@gmail.com', '+918809670375'),
    ('Baghajatin Das', 'baghajatindas5@gmail.com', '+917439702040'),
    ('Akbar Alam A', 'mdakbar64654@gmail.com', '+918228070978'),
    ('Singh Raman', 'peterrjs79@gmail.com', '+919914377423'),
    ('JAAVIR', 'jaavirali2@gmail.com', '+919837074359'),
    ('Ranjit Kumar', 'ranjitkumartha4622@gmail.com', '+919771354622'),
    ('Anju Verma Anju Verma', 'anjuvermaa84@gmail.com', '+919410079120'),
    ('Rahul Kumar jatav', 'rahul6jatav9090@gmail.com', '+919798401789'),
    ('MR Krishna Boss', 'mk8245407@gmail.com', '+917091632585'),
    ('cg___vikash__bhai', 'lakhenewevent@gmail.com', '+919238014180')
),
inserted_leads AS (
  INSERT INTO "Lead" (id, name, company, email, phone, source, status, "assignedToId", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, s.name, s.name, s.email, s.phone, 'Interior Web Site', 'NEW', 'cmuasw8h9000vq5iwnpt9wjm5', now(), now()
  FROM source s
  WHERE NOT EXISTS (
    SELECT 1 FROM "Lead" l
    WHERE l.phone IS NOT NULL
      AND right(regexp_replace(l.phone, '\D', '', 'g'), 10)
        = right(regexp_replace(s.phone, '\D', '', 'g'), 10)
  )
  RETURNING id, name, phone
)
SELECT * FROM inserted_leads ORDER BY name;

-- Review the rows printed above -- should be up to 15 (fewer if any
-- numbers already exist in the CRM some other way). If it looks right:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;
