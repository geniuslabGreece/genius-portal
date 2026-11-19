#!/usr/bin/env bash
# Run on the VM, not in the Lovable preview. Never source or print backend secrets.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STACK_DIR="${STACK_DIR:-/opt/stack/supabase}"
export STACK_DIR
cd "$ROOT"
backend() { docker compose --project-directory "$STACK_DIR" --env-file "$STACK_DIR/.env" -f "$STACK_DIR/docker-compose.yml" -f "$STACK_DIR/portal.override.yml" "$@"; }
portal() { docker compose --env-file "$ROOT/.env" -f docker-compose.yml -f docker-compose.proxy.yml "$@"; }
case "${1:-help}" in
  prepare)
    [[ -f "$STACK_DIR/docker-compose.yml" && -f "$STACK_DIR/.env.example" ]] || { echo 'Install the official backend Docker stack first (see guide).' >&2; exit 1; }
    python3 scripts/prepare-self-host-env.py "$ROOT" "$STACK_DIR"
    cp docker/selfhost/portal.override.yml "$STACK_DIR/portal.override.yml"
    ;;
  backend)
    [[ -f "$STACK_DIR/portal.override.yml" ]] || { echo 'Run prepare first.' >&2; exit 1; }
    backend config --quiet
    # Never copy a Cloud-generated MCP bundle to the VM; export it with mcp-stage.
    for directory in supabase/functions/*; do
      [[ -d "$directory" ]] || continue
      [[ "$(basename "$directory")" != mcp ]] || continue
      cp -R "$directory" "$STACK_DIR/volumes/functions/"
    done
    backend pull
    backend up -d
    ready=false
    for ((i=0; i<60; i++)); do
      if docker exec "${DB_CONTAINER:-supabase-db}" pg_isready -U postgres -d postgres >/dev/null 2>&1; then ready=true; break; fi
      sleep 2
    done
    [[ "$ready" == true ]] || { echo 'Database not ready. Check backend service logs.' >&2; exit 1; }
    backend ps
    ;;
  migrate)
    bash scripts/apply-self-hosted-migrations.sh
    ;;
  mcp-stage)
    python3 scripts/stage-vm-mcp.py
    ;;
  mcp-check)
    python3 scripts/check-vm-mcp.py
    ;;
  https)
    bash docker/proxy/init-certbot.sh
    portal exec -T proxy nginx -t
    ;;
  doctor)
    # Diagnostics only: prints pass/fail, never secret values.
    ok() { echo "OK   $1"; }; bad() { echo "FAIL $1"; }
    getv() { grep -E "^$1=" "$2" 2>/dev/null | head -1 | cut -d= -f2- | tr -d "'\""; }
    for h in geniusnetsoc.gr www.geniusnetsoc.gr api.geniusnetsoc.gr; do
      [[ -n "$(dig +short "$h" 2>/dev/null)" ]] && ok "DNS $h" || bad "DNS $h"
    done
    [[ -f "$STACK_DIR/.env" ]] && ok "backend .env" || bad "backend .env missing"
    [[ -f "$ROOT/.env" ]] && ok "portal .env" || bad "portal .env missing"
    [[ -f "$STACK_DIR/portal.override.yml" ]] && ok "portal.override.yml" || bad "portal.override.yml missing (run prepare)"
    a="$(getv ANON_KEY "$STACK_DIR/.env")"; f="$(getv VITE_SUPABASE_PUBLISHABLE_KEY "$ROOT/.env")"
    [[ -n "$a" && "$a" == "$f" ]] && ok "ANON_KEY matches portal key" || bad "ANON_KEY != VITE_SUPABASE_PUBLISHABLE_KEY"
    [[ "$(getv SITE_URL "$STACK_DIR/.env")" == "https://geniusnetsoc.gr" ]] && ok "SITE_URL" || bad "SITE_URL"
    [[ "$(getv API_EXTERNAL_URL "$STACK_DIR/.env")" == "https://api.geniusnetsoc.gr" ]] && ok "API_EXTERNAL_URL" || bad "API_EXTERNAL_URL"
    for p in GOOGLE AZURE; do
      [[ "$(getv GOTRUE_EXTERNAL_${p}_ENABLED "$STACK_DIR/.env")" == true && -n "$(getv GOTRUE_EXTERNAL_${p}_CLIENT_ID "$STACK_DIR/.env")" && -n "$(getv GOTRUE_EXTERNAL_${p}_SECRET "$STACK_DIR/.env")" ]] && ok "$p login configured" || bad "$p login not configured"
    done
    [[ -n "$(getv LETSENCRYPT_EMAIL "$ROOT/.env")" ]] && ok "LETSENCRYPT_EMAIL" || bad "LETSENCRYPT_EMAIL"
    curl -fsS -o /dev/null http://127.0.0.1:8000/auth/v1/health && ok "backend on :8000" || bad "backend on :8000 not responding"
    if docker ps --format '{{.Names}}' | grep -qx geniusnet-proxy; then
      docker exec geniusnet-proxy wget -q -O /dev/null "http://host.docker.internal:8000/auth/v1/health" 2>/dev/null \
        && ok "proxy reaches backend" || bad "proxy cannot reach :8000 (firewall, step 2)"
    fi
    docker ps --format '{{.Names}}\t{{.Status}}' | grep -E 'restarting|unhealthy' && bad "containers restarting/unhealthy" || ok "no restarting containers"
    ;;
  check)
    backend ps
    portal ps
    curl --fail --silent --show-error https://api.geniusnetsoc.gr/auth/v1/health
    curl --fail --silent --show-error https://api.geniusnetsoc.gr/auth/v1/settings | jq '.external | {google, azure}'
    curl --fail --silent --show-error -o /dev/null https://geniusnetsoc.gr/login
    ;;
  *)
    echo 'Usage: bash scripts/setup-self-host.sh prepare|backend|migrate|https|check|doctor|mcp-stage|mcp-check'
    echo 'Order: prepare, edit env/provider credentials, backend, migrate, import reviewed data, https, check.'
    ;;
esac