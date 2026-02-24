#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if command -v pnpm >/dev/null 2>&1; then
  PKG_MANAGER="pnpm"
  INSTALL_CMD=(pnpm install --frozen-lockfile)
  LINT_CMD=(pnpm lint)
  BUILD_CMD=(pnpm build)
elif command -v npm >/dev/null 2>&1; then
  PKG_MANAGER="npm"
  INSTALL_CMD=(npm ci)
  LINT_CMD=(npm run lint)
  BUILD_CMD=(npm run build)
else
  echo "Error: pnpm or npm is required."
  exit 1
fi

echo "Using package manager: $PKG_MANAGER"

if [[ "${SKIP_INSTALL:-0}" != "1" ]]; then
  echo "Installing dependencies..."
  "${INSTALL_CMD[@]}"
fi

if [[ "${SKIP_LINT:-0}" != "1" ]]; then
  if [[ -f "eslint.config.js" || -f "eslint.config.mjs" || -f "eslint.config.cjs" ]]; then
    echo "Running lint..."
    "${LINT_CMD[@]}"
  else
    echo "No eslint.config.* found. Skipping lint."
  fi
fi

echo "Building app..."
"${BUILD_CMD[@]}"

echo "Build complete."
