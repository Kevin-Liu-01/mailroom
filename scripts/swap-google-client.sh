#!/usr/bin/env bash
# Point Mailroom at a different Google OAuth web client (all Vercel environments + .env.local), then redeploy.
# Usage: scripts/swap-google-client.sh <client_id> <client_secret>
set -euo pipefail
[ $# -eq 2 ] || { echo "usage: $0 <client_id> <client_secret>"; exit 2; }
cd "$(dirname "$0")/.."
for env in production preview development; do
  printf '%s' "$1" | vercel env add AUTH_GOOGLE_ID "$env" --force >/dev/null
  printf '%s' "$2" | vercel env add AUTH_GOOGLE_SECRET "$env" --force >/dev/null
  echo "  AUTH_GOOGLE_ID/SECRET -> $env"
done
if [ -f .env.local ]; then
  python3 - "$1" "$2" <<'PY'
import re, sys
from pathlib import Path
p = Path('.env.local'); s = p.read_text()
s = re.sub(r'^AUTH_GOOGLE_ID=.*$', f'AUTH_GOOGLE_ID={sys.argv[1]}', s, flags=re.M)
s = re.sub(r'^AUTH_GOOGLE_SECRET=.*$', f'AUTH_GOOGLE_SECRET={sys.argv[2]}', s, flags=re.M)
p.write_text(s)
PY
  echo "  .env.local updated"
fi
echo "Existing sign-ins hold refresh tokens for the old client; users reconnect once."
