#!/usr/bin/env bash
set -euo pipefail

# Phase 1: Sanity Checks
if ! curl -s https://registry.npmjs.org >/dev/null; then
  echo "Internet connectivity check failed" >&2
  exit 1
fi

if [ "${EUID}" -ne 0 ]; then
  echo "This script must be run with sudo" >&2
  exit 1
fi

# Phase 2: Nuclear Cleanup
for u in root robert smartocr; do
  sudo -u "$u" pm2 delete all 2>/dev/null || true
  sudo -u "$u" pm2 kill 2>/dev/null || true

done
systemctl stop enterprise-ocr.service 2>/dev/null || true
systemctl disable enterprise-ocr.service 2>/dev/null || true
rm -rf /opt/* /var/www/* 2>/dev/null || true
pkill node 2>/dev/null || true

# Phase 3: Service & Firewall
systemctl enable --now postgresql
systemctl enable --now valkey
systemctl enable --now minio
ufw allow 22/tcp
ufw allow 3001/tcp
ufw allow 5432/tcp
ufw allow 6379/tcp
ufw allow 9000/tcp
ufw allow 9001/tcp
ufw --force enable

# Phase 4: Application Deployment
APP_DIR="/home/robert/enterprise-ocr-system"
cd "$APP_DIR"
rm -rf node_modules dist .env
cp .env.example .env
npm install
npm run build

if [ ! -f dist/api.js ] || [ ! -f dist/workers.js ]; then
  echo "Build output missing" >&2
  exit 1
fi

# Phase 5: Database Initialization
sudo -u postgres psql -c "ALTER ROLE ocr_user WITH CREATEDB;"
npx prisma migrate dev --name init
npx prisma generate
npx prisma db seed

# Phase 6: Launch
pm2 start ecosystem.config.cjs --env production
pm2 save
curl -f http://localhost:3001/api/health

echo "Deployment complete"
