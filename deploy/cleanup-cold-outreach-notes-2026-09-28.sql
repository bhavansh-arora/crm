-- One-off cleanup: strip "; verify number before calling." from the notes
-- added by the Cold Outreach batch import, leaving a clean sentence ending
-- (e.g. "...From cold-outreach no-website list.").
--
-- Run INTERACTIVELY (not piped with -f/<) so you can review the rows it's
-- about to change before committing:
--   docker compose exec postgres psql -U crm -d crm
-- Paste everything below down to (not including) the final comment, check
-- the rows it prints, then type COMMIT; or ROLLBACK; yourself.

BEGIN;

UPDATE "Activity" a
SET note = replace(a.note, '; verify number before calling.', '.')
FROM "Lead" l
WHERE a."leadId" = l.id
  AND l.source = 'Cold Outreach'
  AND a.note LIKE '%verify number before calling.%'
RETURNING a."leadId", a.note;

-- Review the rows printed above -- should be up to 83. If it looks right:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;
