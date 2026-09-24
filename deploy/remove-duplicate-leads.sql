-- Removes the "no follow-up" side of each duplicate-phone pair, keeping
-- whichever lead(s) sharing that phone number DO have at least one
-- follow-up scheduled. Matches Activity/FollowUp/PaymentLink cascade
-- deletes already set up in the schema, so a deleted lead's activity
-- history goes with it -- run deploy/find-duplicate-leads.sql first and
-- check the activity_count/payment_link_count columns for anything you'd
-- want to preserve before running this.
--
-- Does NOT touch a duplicate pair where NEITHER side has a follow-up --
-- that's not disambiguated by this rule, so it's left for you to review
-- and delete manually if needed (find-duplicate-leads.sql will still show
-- these; they just won't be deleted here).
--
-- This must be run INTERACTIVELY, not piped in with -f/< -- the point of
-- BEGIN...COMMIT/ROLLBACK here is to let you see exactly which rows would
-- be deleted before it's permanent, and a non-interactive run would just
-- hit the connection-close implicit ROLLBACK at the end having shown you
-- nothing.
--
-- On the VPS:      docker compose exec postgres psql -U crm -d crm
-- Against Neon:    psql "$DATABASE_URL"
-- Then paste everything below down to (not including) the final comment,
-- check the rows it prints, and type COMMIT; or ROLLBACK; yourself.

BEGIN;

DELETE FROM "Lead" l
WHERE l.phone IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "FollowUp" f WHERE f."leadId" = l.id)
  AND EXISTS (
    SELECT 1
    FROM "Lead" l2
    WHERE l2.id <> l.id
      AND l2.phone IS NOT NULL
      AND right(regexp_replace(l2.phone, '\D', '', 'g'), 10)
        = right(regexp_replace(l.phone, '\D', '', 'g'), 10)
      AND EXISTS (SELECT 1 FROM "FollowUp" f2 WHERE f2."leadId" = l2.id)
  )
RETURNING id, name, phone, status, "createdAt";

-- Review the rows printed above. If they're exactly the leads you expect
-- removed, run:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;
