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
    # Keep the upstream main router. MCP still requires separate issuer configuration.
    for directory in supabase/functions/*; do
      [[ -d "$directory" ]] || continue
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
  https)
    bash docker/proxy/init-certbot.sh
    portal exec -T proxy nginx -t
    ;;
  check)
    backend ps
    portal ps
    curl --fail --silent --show-error https://api.geniusnetsoc.gr/auth/v1/health
    curl --fail --silent --show-error https://api.geniusnetsoc.gr/auth/v1/settings | jq '.external | {google, azure}'
    curl --fail --silent --show-error -o /dev/null https://geniusnetsoc.gr/login
    ;;
  *)
    echo 'Usage: bash scripts/setup-self-host.sh prepare|backend|migrate|https|check'
    echo 'Order: prepare, edit env/provider credentials, backend, migrate, import reviewed data, https, check.'
    ;;
esac