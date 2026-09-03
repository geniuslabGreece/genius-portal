#!/usr/bin/env bash
# Πρώτη έκδοση πιστοποιητικού Let's Encrypt για το domain του portal.
# Τρέξε το ΜΙΑ φορά στο VM, αφού τα A records δείχνουν στο VM:
#   ./docker/proxy/init-certbot.sh
set -e

cd "$(dirname "$0")/../.."

# shellcheck disable=SC1091
[ -f .env ] && set -a && . ./.env && set +a

DOMAIN="${DOMAIN:?DOMAIN λείπει από το .env}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL λείπει από το .env}"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.proxy.yml"

echo "[1/3] Εκκίνηση portal + proxy σε HTTP bootstrap mode..."
$COMPOSE up -d --build portal proxy

echo "[2/3] Έκδοση πιστοποιητικού για ${DOMAIN} και www.${DOMAIN}..."
$COMPOSE run --rm --entrypoint "certbot" certbot certonly \
  --webroot -w /var/www/certbot \
  -d "${DOMAIN}" -d "www.${DOMAIN}" \
  --email "${LETSENCRYPT_EMAIL}" \
  --agree-tos --no-eff-email --non-interactive

echo "[3/3] Επανεκκίνηση proxy σε HTTPS mode..."
$COMPOSE up -d --force-recreate proxy
$COMPOSE up -d certbot

echo "OK → https://${DOMAIN}"
