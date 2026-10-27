#!/bin/sh
# Publica dist/ no Firebase Hosting (HTTPS público, instalável como PWA).
#   FIREBASE_PROJECT              id do projeto (obrigatório)
#   GOOGLE_APPLICATION_CREDENTIALS  caminho do JSON da conta de serviço, OU
#   FIREBASE_SERVICE_ACCOUNT_JSON   o conteúdo do JSON (vem de um segredo do ambiente)
set -eu
: "${FIREBASE_PROJECT:?defina FIREBASE_PROJECT com o id do projeto Firebase}"
if [ -n "${FIREBASE_SERVICE_ACCOUNT_JSON:-}" ]; then
  KEY="$(mktemp)"; trap 'rm -f "$KEY"' EXIT
  printf '%s' "$FIREBASE_SERVICE_ACCOUNT_JSON" > "$KEY"; chmod 600 "$KEY"
  export GOOGLE_APPLICATION_CREDENTIALS="$KEY"
fi
: "${GOOGLE_APPLICATION_CREDENTIALS:?falta a credencial da conta de serviço}"
npm run build
npx --yes firebase-tools@15.34.1 deploy --only hosting --project "$FIREBASE_PROJECT" --non-interactive
echo "No ar: https://${FIREBASE_PROJECT}.web.app"
