#!/usr/bin/env bash
#
# Publish the built place to Roblox through the Open Cloud Assets API.
#
# What this does and does not do:
#   DOES  — overwrite an EXISTING place with new content, fully unattended.
#   DOES NOT — create the experience itself, or create Game Passes and
#           Developer Products. Open Cloud has no endpoint for either, so those
#           are one-time manual steps. See docs/PUBLISHING.md.
#
# Endpoint (per the current Roblox docs):
#   PATCH https://apis.roblox.com/assets/v1/assets/{placeId}
#   multipart: request = {"assetId":…, "assetType":"Place", "published":true}
#              fileContent = the .rbxl, type application/octet-stream
# The call is ASYNCHRONOUS: it returns an operation id which this script polls
# until the upload is actually done. A 200 on the PATCH alone does not mean the
# place was published.
#
# Note: no Universe ID is needed. The Assets API addresses the place directly,
# and a place's asset id IS its Place ID.
#
# Required environment:
#   ROBLOX_API_KEY   Open Cloud key with the `assets` API system and
#                    Read + Write operations on this experience
#   ROBLOX_PLACE_ID
#
# Usage:
#   export ROBLOX_API_KEY=...
#   export ROBLOX_PLACE_ID=...
#   ./scripts/publish.sh            # build + publish live
#   ./scripts/publish.sh --saved    # build + upload WITHOUT publishing
set -euo pipefail
cd "$(dirname "$0")/.."

PUBLISHED=true
LABEL="publicando (vai ao ar)"
if [[ "${1:-}" == "--saved" ]]; then
  PUBLISHED=false
  LABEL="enviando como versão não publicada"
fi

: "${ROBLOX_API_KEY:?defina ROBLOX_API_KEY}"
: "${ROBLOX_PLACE_ID:?defina ROBLOX_PLACE_ID}"

OUT="build/StealAndGrow.rbxl"
./scripts/build.sh "$OUT"

echo "==> ${LABEL}: place ${ROBLOX_PLACE_ID}"

BODY=$(mktemp)
CODE=$(curl -sS -X PATCH "https://apis.roblox.com/assets/v1/assets/${ROBLOX_PLACE_ID}" \
  -H "x-api-key: ${ROBLOX_API_KEY}" \
  -F "request={\"assetId\": ${ROBLOX_PLACE_ID}, \"assetType\": \"Place\", \"published\": ${PUBLISHED}}" \
  -F "fileContent=@${OUT};type=application/octet-stream" \
  -o "$BODY" -w "%{http_code}")

echo "HTTP ${CODE}"
cat "$BODY"; echo

if [[ "$CODE" != "200" && "$CODE" != "201" ]]; then
  echo
  case "$CODE" in
    401) echo "!! 401 — chave inválida para esta operação."
         echo "   Confira: API system 'assets' com operações Read E Write,"
         echo "   a experiência marcada em 'Restrict by Experience' (ou o toggle desligado),"
         echo "   e se a chave não expirou (chave sem uso por 60 dias auto-expira)." ;;
    403) echo "!! 403 — sem permissão neste place. Causa mais comum: Team Create ligado." ;;
    400) echo "!! 400 — Place ID inválido, ou o arquivo não é um place válido." ;;
    404) echo "!! 404 — Place ID não encontrado." ;;
    *)   echo "!! falha inesperada." ;;
  esac
  rm -f "$BODY"
  exit 1
fi

OPERATION=$(python3 -c "
import json, sys
d = json.load(open('$BODY'))
print((d.get('path') or '').split('/')[-1])
" 2>/dev/null || true)
rm -f "$BODY"

if [[ -z "$OPERATION" ]]; then
  echo "!! a resposta não trouxe um id de operação; não é possível confirmar a publicação."
  exit 1
fi

echo "==> operação ${OPERATION} — aguardando o processamento"

for attempt in $(seq 1 40); do
  sleep 3
  POLL=$(mktemp)
  PCODE=$(curl -sS "https://apis.roblox.com/assets/v1/operations/${OPERATION}" \
    -H "x-api-key: ${ROBLOX_API_KEY}" -o "$POLL" -w "%{http_code}")
  if [[ "$PCODE" != "200" ]]; then
    echo "   tentativa ${attempt}: HTTP ${PCODE}"
    rm -f "$POLL"
    continue
  fi
  RESULT=$(python3 -c "
import json
d = json.load(open('$POLL'))
if not d.get('done'):
    print('PENDING')
elif 'error' in d:
    e = d['error']
    print('ERROR', e.get('code', '?'), e.get('message', ''))
else:
    r = d.get('response', {})
    print('OK', r.get('revisionId', '?'), r.get('isPublished', '?'))
")
  rm -f "$POLL"
  case "$RESULT" in
    PENDING) echo "   tentativa ${attempt}: processando..." ;;
    OK*)     echo "==> ${RESULT#OK }" | sed 's/^==> /==> revisão /'
             echo "==> publicado com sucesso."
             exit 0 ;;
    ERROR*)  echo "!! a Roblox rejeitou o upload: ${RESULT#ERROR }"
             exit 1 ;;
  esac
done

echo "!! a operação não terminou em ~2 minutos. Confira o histórico de versões do place."
exit 1
