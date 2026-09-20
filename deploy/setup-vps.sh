#!/bin/bash
# One-shot setup for a fresh Ubuntu/Debian VPS. Run as root (or with sudo):
#
#   curl -fsSL https://raw.githubusercontent.com/bhavansh-arora/crm/claude/crm-admin-lead-management-2dea2w/deploy/setup-vps.sh -o setup-vps.sh
#   bash setup-vps.sh
#
# It installs Docker, opens the firewall, clones the app, generates the
# production .env (asking for a Postgres connection string, an admin
# email/password, and optionally a domain), builds the image, starts
# everything, and schedules the follow-up reminder check. Safe to re-run —
# it pulls the latest code and redeploys without touching your existing
# .env or database.
set -euo pipefail

REPO_URL="https://github.com/bhavansh-arora/crm.git"
BRANCH="claude/crm-admin-lead-management-2dea2w"
APP_DIR="/opt/crm"

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run this as root (or with sudo)." >&2
  exit 1
fi

echo "==> Installing Docker (skipped if already installed)..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> Opening firewall ports (22, 80, 443)..."
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1 || true
fi

echo "==> Fetching app code into $APP_DIR..."
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

SERVER_IP="$(curl -fsSL ifconfig.me || echo 'YOUR_SERVER_IP')"

if [ ! -f .env ]; then
  echo ""
  echo "==> First-time setup. A few questions (press Enter to accept defaults):"
  echo ""
  echo "This app needs a Postgres database. If you don't have one yet, create"
  echo "a free one at https://neon.tech (takes ~1 minute) and copy its"
  echo "connection string — it looks like postgresql://user:pass@host/db."
  read -rp "Postgres connection string (DATABASE_URL): " DB_URL
  while [ -z "$DB_URL" ]; do
    read -rp "This is required — paste your Postgres connection string: " DB_URL
  done

  read -rp "Admin email [admin@example.com]: " ADMIN_EMAIL
  ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}

  read -rsp "Admin password [leave blank to auto-generate]: " ADMIN_PASSWORD
  echo ""
  ADMIN_PASSWORD=${ADMIN_PASSWORD:-$(openssl rand -base64 12)}

  read -rp "Domain name already pointed at this server's IP ($SERVER_IP), or leave blank to use the IP for now: " DOMAIN

  cp .env.production.example .env

  NEXTAUTH_SECRET="$(openssl rand -base64 32)"
  CRON_SECRET="$(openssl rand -base64 24)"
  if [ -n "$DOMAIN" ]; then
    SITE_URL="https://$DOMAIN"
  else
    SITE_URL="http://$SERVER_IP"
  fi

  # DB_URL may contain '#' or other sed-unfriendly characters; use '|' as the
  # sed delimiter instead of the '#' used for the other substitutions.
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$DB_URL\"|" .env
  sed -i "s#^NEXTAUTH_SECRET=.*#NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\"#" .env
  sed -i "s#^NEXTAUTH_URL=.*#NEXTAUTH_URL=\"$SITE_URL\"#" .env
  sed -i "s#^SEED_ADMIN_EMAIL=.*#SEED_ADMIN_EMAIL=\"$ADMIN_EMAIL\"#" .env
  sed -i "s#^SEED_ADMIN_PASSWORD=.*#SEED_ADMIN_PASSWORD=\"$ADMIN_PASSWORD\"#" .env
  sed -i "s#^CRON_SECRET=.*#CRON_SECRET=\"$CRON_SECRET\"#" .env

  if [ -n "$DOMAIN" ]; then
    printf '%s {\n\treverse_proxy app:3000\n}\n' "$DOMAIN" > Caddyfile
  fi

  echo ""
  echo "==================================================================="
  echo " Admin login: $ADMIN_EMAIL / $ADMIN_PASSWORD"
  echo " (also saved in $APP_DIR/.env — change the password after you log in)"
  echo "==================================================================="
else
  echo "==> Existing .env found, reusing it (not overwriting)."
  EXISTING_URL="$(grep '^NEXTAUTH_URL=' .env | cut -d'"' -f2)"
  case "$EXISTING_URL" in
    https://*) DOMAIN="${EXISTING_URL#https://}" ;;
    *) DOMAIN="" ;;
  esac
fi

echo ""
echo "==> Building and starting the app (first build takes a few minutes)..."
docker compose up -d --build

echo "==> Scheduling the follow-up reminder check every 10 minutes..."
CRON_SECRET_VALUE="$(grep '^CRON_SECRET=' .env | cut -d'"' -f2)"
CRON_LINE="*/10 * * * * curl -s -H \"Authorization: Bearer $CRON_SECRET_VALUE\" http://localhost/api/cron/reminders >/dev/null 2>&1"
( crontab -l 2>/dev/null | grep -v "api/cron/reminders" ; echo "$CRON_LINE" ) | crontab -

echo ""
echo "==================================================================="
if [ -n "${DOMAIN:-}" ]; then
  echo " Live at: https://$DOMAIN  (certificate issues automatically —"
  echo " give it a minute on first run)"
else
  echo " Live at: http://$SERVER_IP"
  echo ""
  echo " No domain yet, so this is plain HTTP — fine to try out, but get a"
  echo " cheap domain and re-run this script when you're ready for HTTPS"
  echo " (recommended before real passwords/data go in)."
fi
echo ""
echo " Logs:     cd $APP_DIR && docker compose logs -f"
echo " Redeploy: cd $APP_DIR && bash deploy/setup-vps.sh"
echo "==================================================================="
