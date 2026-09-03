#!/bin/sh
set -e

: "${DOMAIN:?DOMAIN is required}"
: "${API_DOMAIN:=api.${DOMAIN}}"
: "${SUPABASE_API_UPSTREAM:=host.docker.internal:8000}"
export API_DOMAIN SUPABASE_API_UPSTREAM

CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

if [ -f "$CERT" ]; then
  echo "[proxy] Βρέθηκε πιστοποιητικό για ${DOMAIN} → HTTPS mode"
  TEMPLATE=/templates/default.conf.template
else
  echo "[proxy] Δεν υπάρχει ακόμα πιστοποιητικό για ${DOMAIN} → HTTP bootstrap mode"
  TEMPLATE=/templates/bootstrap.conf.template
fi

envsubst '${DOMAIN} ${API_DOMAIN} ${SUPABASE_API_UPSTREAM}' < "$TEMPLATE" > /etc/nginx/conf.d/default.conf

# Auto-reload ώστε να πιάνει τις ανανεώσεις certbot
( while :; do sleep 12h; nginx -s reload 2>/dev/null || true; done ) &

exec nginx -g 'daemon off;'
