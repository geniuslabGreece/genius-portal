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

docker exec -i "$DB_CONTAINER" psql -X -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS portal_migrations;
CREATE TABLE IF NOT EXISTS portal_migrations.applied_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

mapfile -t migrations < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -print | LC_ALL=C sort)
if [[ ${#migrations[@]} -eq 0 ]]; then
  echo "Error: no SQL migrations found in '$MIGRATIONS_DIR'." >&2
  exit 1
fi

echo "Applying ${#migrations[@]} migrations directly inside '$DB_CONTAINER'..."
for migration in "${migrations[@]}"; do
  migration_name="$(basename "$migration")"
  if [[ ! "$migration_name" =~ ^[A-Za-z0-9._-]+$ ]]; then
    echo "Error: unsupported migration filename '$migration_name'." >&2
    exit 1
  fi
  applied="$(docker exec "$DB_CONTAINER" psql -X -U "$DB_USER" -d "$DB_NAME" -Atqc \
    "SELECT 1 FROM portal_migrations.applied_migrations WHERE filename = '$migration_name'")"
  if [[ "$applied" == "1" ]]; then
    echo "↷ $migration (already applied)"
    continue
  fi
  echo "→ $migration"
  if ! { cat "$migration"; printf "\nINSERT INTO portal_migrations.applied_migrations (filename) VALUES ('%s');\n" "$migration_name"; } | \
    docker exec -i "$DB_CONTAINER" psql -X -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 --single-transaction; then
    echo "Migration failed: $migration" >&2
    exit 1
  fi
done

echo "All migrations completed successfully."