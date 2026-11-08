#!/usr/bin/env bash
# Build the place file from source. Requires rojo (see aftman.toml).
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-build/StealAndGrow.rbxl}"
mkdir -p "$(dirname "$OUT")"

if ! command -v rojo >/dev/null 2>&1; then
  echo "rojo não encontrado."
  echo "Instale com:  cargo install rojo   (ou aftman install, usando o aftman.toml deste repo)"
  exit 1
fi

echo "==> rojo build"
rojo build . --output "$OUT"
ls -lh "$OUT"
echo "==> OK: $OUT"
