#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

if [ -f ".env.local" ]; then
  set -a
  source ".env.local"
  set +a
fi

if [ -f ".env" ]; then
  set -a
  source ".env"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Update .env.local or .env before starting."
  exit 1
fi

if ! psql "$DATABASE_URL" -c "select 1" >/dev/null 2>&1; then
  echo "Postgres not reachable. Attempting to start local Postgres..."
  if command -v brew >/dev/null 2>&1; then
    brew services start postgresql@16 >/dev/null 2>&1 || true
  fi
  if ! psql "$DATABASE_URL" -c "select 1" >/dev/null 2>&1; then
    if [ -x "/opt/homebrew/opt/postgresql@16/bin/pg_ctl" ]; then
      /opt/homebrew/opt/postgresql@16/bin/pg_ctl -D /opt/homebrew/var/postgresql@16 start >/dev/null 2>&1 || true
    fi
  fi
fi

if ! psql "$DATABASE_URL" -c "select 1" >/dev/null 2>&1; then
  echo "Postgres still not reachable. Start it manually and try again."
  echo "Example:"
  echo "  LC_ALL=\"en_US.UTF-8\" /opt/homebrew/opt/postgresql@16/bin/postgres -D /opt/homebrew/var/postgresql@16"
  exit 1
fi

echo "Postgres is up. Starting Next.js dev server..."
npm run dev
