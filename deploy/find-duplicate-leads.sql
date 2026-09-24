-- Finds leads that share a phone number (normalized to the last 10 digits,
-- so "9876543210", "+91 98765 43210", and "098765-43210" are all recognized
-- as the same number -- matching the duplicate check the app now runs on
-- lead creation).
--
-- Usage on the VPS:
--   docker compose exec -T postgres psql -U crm -d crm -f - < deploy/find-duplicate-leads.sql
-- Or against Neon: psql "$DATABASE_URL" -f deploy/find-duplicate-leads.sql
--
-- This is READ-ONLY. Review the output, then see
-- deploy/remove-duplicate-leads.sql to actually delete anything.

SELECT
  l.id,
  l.name,
  l.phone,
  right(regexp_replace(l.phone, '\D', '', 'g'), 10) AS normalized_phone,
  l.status,
  l."createdAt",
  (SELECT count(*) FROM "FollowUp" f WHERE f."leadId" = l.id) AS followup_count,
  (SELECT count(*) FROM "Activity" a WHERE a."leadId" = l.id) AS activity_count,
  (SELECT count(*) FROM "PaymentLink" p WHERE p."leadId" = l.id) AS payment_link_count
FROM "Lead" l
WHERE l.phone IS NOT NULL
  AND right(regexp_replace(l.phone, '\D', '', 'g'), 10) IN (
    SELECT right(regexp_replace(phone, '\D', '', 'g'), 10)
    FROM "Lead"
    WHERE phone IS NOT NULL
    GROUP BY right(regexp_replace(phone, '\D', '', 'g'), 10)
    HAVING count(*) > 1
  )
ORDER BY normalized_phone, l."createdAt";
