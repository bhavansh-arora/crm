#!/bin/bash
# Nightly backup of the self-hosted Postgres database. Run from a crontab
# entry (setup-vps.sh schedules this automatically once Postgres is
# self-hosted). Keeps the last 30 daily backups, deletes older ones.
set -euo pipefail

APP_DIR="/opt/crm"
BACKUP_DIR="$APP_DIR/backups"
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

STAMP="$(date +%F)"
docker compose exec -T postgres pg_dump -U crm -Fc crm > "$BACKUP_DIR/crm-$STAMP.dump"

# Invoice PDFs and monthly/yearly registers, from the app container's
# invoices volume. (The database above is the source of truth -- any PDF
# can be re-created from it -- but this keeps an exact copy of what was
# issued.)
docker compose exec -T app tar -czf - -C /app invoices > "$BACKUP_DIR/invoices-$STAMP.tar.gz" || true

find "$BACKUP_DIR" -name 'crm-*.dump' -mtime "+$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name 'invoices-*.tar.gz' -mtime "+$KEEP_DAYS" -delete
