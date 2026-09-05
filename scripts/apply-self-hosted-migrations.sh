#!/usr/bin/env bash
set -Eeuo pipefail

DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-supabase/migrations}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or is not available in PATH." >&2
  exit 1
fi

if ! docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  echo "Error: database container '$DB_CONTAINER' was not found." >&2
  echo "Set DB_CONTAINER if your self-hosted stack uses a different container name." >&2
  exit 1
fi

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "Error: migrations directory '$MIGRATIONS_DIR' was not found." >&2
  exit 1
fi

if ! docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null; then
  echo "Error: PostgreSQL is not ready inside '$DB_CONTAINER'." >&2
  exit 1
fi

mapfile -t migrations < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -print | LC_ALL=C sort)
if [[ ${#migrations[@]} -eq 0 ]]; then
  echo "Error: no SQL migrations found in '$MIGRATIONS_DIR'." >&2
  exit 1
fi

echo "Applying ${#migrations[@]} migrations directly inside '$DB_CONTAINER'..."
for migration in "${migrations[@]}"; do
  echo "→ $migration"
  if ! docker exec -i "$DB_CONTAINER" \
    psql -X -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$migration"; then
    echo "Migration failed: $migration" >&2
    exit 1
  fi
done

echo "All migrations completed successfully."