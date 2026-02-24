#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

DEPLOY_TARGET="${1:-local}"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "Running build before deploy..."
  "$ROOT_DIR/build.sh"
fi

case "$DEPLOY_TARGET" in
  local)
    echo "No cloud app deploy selected."
    echo "Build artifacts are ready. Use 'pnpm start' to run the production app locally."
    ;;
  db|supabase)
    if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
      echo "Error: SUPABASE_DB_URL is not set."
      echo "Set SUPABASE_DB_URL to your Postgres connection string to run DB deploy."
      exit 1
    fi

    if ! command -v psql >/dev/null 2>&1; then
      echo "Error: psql not found."
      echo "Install PostgreSQL client tools to apply migrations/seeds from this script."
      exit 1
    fi

    echo "Applying migration..."
    psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/supabase/migrations/202602230001_init_revenue_app.sql"

    echo "Applying seed..."
    psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/supabase/seed.sql"
    ;;
  vercel)
    if ! command -v vercel >/dev/null 2>&1; then
      echo "Error: Vercel CLI not found."
      echo "Install with: npm i -g vercel"
      exit 1
    fi

    if [[ "${VERCEL_PREVIEW:-0}" == "1" ]]; then
      echo "Deploying preview to Vercel..."
      vercel --yes
    else
      echo "Deploying production to Vercel..."
      vercel deploy --prod --yes
    fi
    ;;
  *)
    echo "Unsupported deploy target: $DEPLOY_TARGET"
    echo "Supported: local (default), db, supabase, vercel"
    exit 1
    ;;
esac

echo "Deploy complete."
