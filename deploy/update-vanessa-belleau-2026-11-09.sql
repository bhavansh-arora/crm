-- Update Vanessa Belleau's lead (High Fifteen) with the full conversation
-- so far: she reviewed the preview, asked about process/pricing, and got
-- a $699 quote on 5 Nov. Status left as NEW per request (not moved to
-- Negotiation/Hot).
--
-- Run INTERACTIVELY (not piped with -f/<) so you can review before
-- committing:
--   docker compose exec postgres psql -U crm -d crm
-- Paste everything below down to (not including) the final comment, check
-- what it prints, then type COMMIT; or ROLLBACK; yourself.

BEGIN;

INSERT INTO "Activity" (id, "leadId", "userId", type, note, "createdAt")
SELECT gen_random_uuid()::text, id, 'cmuf554b7007iixqkmf2wi80u', 'NOTE',
  'Cold email to High Fifteen (executive coaching, inclusive high performance cultures) from Everly (Code Bunny). Vanessa (founder) agreed to a free preview, sent 2 Nov at https://highfifteen.codebunny.net/. Followed up 5 Nov; Vanessa reviewed it (liked some elements, not all) and asked how working together would proceed, pricing and services, before agreeing to more free work. Quoted $699 USD for the full project (design refined to her feedback, enquiry/booking journey, mobile, SEO, hosting + management first year, testing and launch) on 5 Nov and offered to get started -- no reply yet.',
  now()
FROM "Lead" WHERE phone = '+447799620339'
RETURNING "leadId";

-- Review the row above. If it looks right:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;
