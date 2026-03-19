#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL is not set." >&2
  exit 1
fi

if [[ -z "${BACKUP_DIR:-}" ]]; then
  echo "BACKUP_DIR is not set." >&2
  exit 1
fi

timestamp="$(date '+%Y-%m-%d_%H%M%S')"
target_dir="${BACKUP_DIR}/db"
target_file="${target_dir}/db_${timestamp}.dump"

mkdir -p "${target_dir}"

pg_dump \
  "${SUPABASE_DB_URL}" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="${target_file}"

echo "DB backup created: ${target_file}"
