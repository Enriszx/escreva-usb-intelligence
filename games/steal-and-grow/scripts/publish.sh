#!/usr/bin/env bash
#
# Publish the built place to Roblox via the Open Cloud API.
#
# What this does and does not do:
#   DOES  — overwrite an EXISTING place with a new published version, fully
#           unattended. This is the whole update pipeline.
#   DOES NOT — create the experience itself or create Game Passes. Roblox's
#           Open Cloud has no endpoint for either (confirmed against the
#           current place-publishing docs), so those two steps are manual and
#           one-time. See docs/PUBLISHING.md.
#
# Required environment:
#   ROBLOX_API_KEY   an Open Cloud API key with the
#                    "universe-places:write" scope, scoped to your universe
#   ROBLOX_UNIVERSE_ID
#   ROBLOX_PLACE_ID
#
# Usage:
#   export ROBLOX_API_KEY=...
#   export ROBLOX_UNIVERSE_ID=...
#   export ROBLOX_PLACE_ID=...
#   ./scripts/publish.sh              # build + publish live
#   ./scripts/publish.sh --saved      # build + upload as a SAVED (not live) version
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION_TYPE="Published"
if [[ "${1:-}" == "--saved" ]]; then
  VERSION_TYPE="Saved"
fi

: "${ROBLOX_API_KEY:?defina ROBLOX_API_KEY}"
: "${ROBLOX_UNIVERSE_ID:?defina ROBLOX_UNIVERSE_ID}"
: "${ROBLOX_PLACE_ID:?defina ROBLOX_PLACE_ID}"

OUT="build/StealAndGrow.rbxl"
./scripts/build.sh "$OUT"

URL="https://apis.roblox.com/universes/v1/${ROBLOX_UNIVERSE_ID}/places/${ROBLOX_PLACE_ID}/versions?versionType=${VERSION_TYPE}"

echo "==> publicando (${VERSION_TYPE}) universe=${ROBLOX_UNIVERSE_ID} place=${ROBLOX_PLACE_ID}"

HTTP_BODY=$(mktemp)
HTTP_CODE=$(curl -sS -X POST "$URL" \
  -H "x-api-key: ${ROBLOX_API_KEY}" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@${OUT}" \
  -o "$HTTP_BODY" -w "%{http_code}")

echo "HTTP ${HTTP_CODE}"
cat "$HTTP_BODY"; echo
rm -f "$HTTP_BODY"

case "$HTTP_CODE" in
  200|201)
    echo "==> publicado com sucesso."
    ;;
  401)
    echo "!! 401 — a chave não é válida para esta operação."
    echo "   Confira: escopo 'universe-places:write', o universo correto na chave,"
    echo "   e o IP de origem permitido (use 0.0.0.0/0 para testar)."
    exit 1
    ;;
  403)
    echo "!! 403 — publicação não permitida neste place."
    echo "   Causa mais comum: Team Create ligado. Desligue e tente de novo."
    exit 1
    ;;
  400)
    echo "!! 400 — o place não pertence a esse universo, ou o arquivo é inválido."
    exit 1
    ;;
  *)
    echo "!! falha inesperada."
    exit 1
    ;;
esac
