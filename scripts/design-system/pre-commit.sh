#!/usr/bin/env bash
# Guarda do design system no commit: só roda se o stage tocar o web ou o design system.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
if git diff --cached --name-only | grep -qE '^(web/|\.docs/design-system/|scripts/design-system/)'; then
  node scripts/design-system/check.mjs >/dev/null || {
    echo "❌ pre-commit: o design system não passou em scripts/design-system/check.mjs." >&2
    echo "   Rode: (cd web && npm run ds:sync && npm run ds:check)" >&2
    exit 1
  }
fi
