-- One-off import: rows 75-87 of Facebook_Website_Leads_1.xlsx (the earlier
-- rows are already in the CRM). Source "Ads", assigned to Tanmay
-- (cmuasw8h9000vq5iwnpt9wjm5), left at the default status "NEW" (uncontacted).
--
-- Run INTERACTIVELY (not piped with -f/<) so you can review the rows it's
-- about to insert before committing:
--   docker compose exec postgres psql -U crm -d crm
-- Paste everything below down to (not including) the final comment, check
-- the rows it prints, then type COMMIT; or ROLLBACK; yourself.
--
-- Duplicate-safe: skips any row whose phone (normalized to its last 10
-- digits, so formatting differences don't matter) already exists in the
-- Lead table -- same rule the app itself uses.

BEGIN;

INSERT INTO "Lead" (id, name, email, phone, source, status, "assignedToId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  v.name,
  v.email,
  v.phone,
  'Ads',
  'NEW',
  'cmuasw8h9000vq5iwnpt9wjm5',
  now(),
  now()
FROM (VALUES
  ('Antony Cj Anto', 'antonycj229@gmail.com', '+919745838089'),
  ('P cutie Rani', 'chandanazam2@gmail.com', '+917004109330'),
  ('Mary Enas', 'cadiusa@msn.com', '+1(630) 589-4047'),
  ('Mithlesh Gupta Ji', 'mithleshkumar46473@gmail.com', '+918340148291'),
  ('《RITIK》....', 'rujitmurah@gmail.com', '+917638804535'),
  ('vipin__rajputtt', 'vipinsinghrajput0501@gmail.com', '+917219921963'),
  ('Anish Yadav Yadav Ji', 'satishyadav16266@gmail.com', '+917447030225'),
  ('Pinky Devi', 'pinkykumarihzb45690@gmail.com', '+919341635362'),
  ('Sanowar Vlogger', 'sanowarhossain344as@gmail.com', '+919134465579'),
  ('Armaan Khan', 'shadabsaifi22169@gmail.com', '+918476971017'),
  ('Samara Mundo', 'samaramunda7847@gmail.com', '+18763431593'),
  ('Ankit Singh', 'ankitkumarsamhota2010@gmail.com', '+918578897969'),
  ('Kundan Kumar Jha', 'kundankumarjha436@gmail.com', '+917352192208')
) AS v(name, email, phone)
WHERE NOT EXISTS (
  SELECT 1 FROM "Lead" l
  WHERE l.phone IS NOT NULL
    AND right(regexp_replace(l.phone, '\D', '', 'g'), 10)
      = right(regexp_replace(v.phone, '\D', '', 'g'), 10)
)
RETURNING id, name, phone;

-- Review the rows printed above -- should be all 13 (or fewer, if any
-- already snuck in some other way). If it looks right:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;
