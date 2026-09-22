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

find "$BACKUP_DIR" -name 'crm-*.dump' -mtime "+$KEEP_DAYS" -delete
