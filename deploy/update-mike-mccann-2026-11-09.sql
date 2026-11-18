-- Update Mike McCann's lead (SunFlow Solar and Exteriors): Mike assigned
-- Colleen to assess the site; we sent a preview at
-- https://sunflow.codebunny.net/; a week later Colleen hadn't been able to
-- check it, so plan is to follow up directly with Mike (the owner) and
-- show him the preview himself.
--
-- Run INTERACTIVELY (not piped with -f/<) so you can review the rows
-- before committing:
--   docker compose exec postgres psql -U crm -d crm
-- Paste everything below down to (not including) the final comment, check
-- what it prints, then type COMMIT; or ROLLBACK; yourself.

BEGIN;

UPDATE "Lead" SET website = 'https://sunflow.codebunny.net/', "updatedAt" = now()
WHERE phone = '+16476889908'
RETURNING id, name, website;

INSERT INTO "Activity" (id, "leadId", "userId", type, note, "createdAt")
SELECT gen_random_uuid()::text, id, 'cmuf554b7007iixqkmf2wi80u', 'NOTE',
  'Mike assigned Colleen to assess the site; sent her a preview at https://sunflow.codebunny.net/. A week later Colleen hasn''t been able to check it, so following up directly with Mike (the owner) and showing him the preview himself.',
  now()
FROM "Lead" WHERE phone = '+16476889908'
RETURNING "leadId";

-- Review the rows above. If it looks right:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;
