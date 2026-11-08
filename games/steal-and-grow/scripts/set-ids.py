#!/usr/bin/env python3
"""
Write real Game Pass / Developer Product IDs into the config files.

Roblox has no API to CREATE passes or products, so you create them once on the
website and then run this to wire the IDs in. It edits only the `id = 0` field
of the entry you name, so it is safe to re-run.

Usage:
    python3 scripts/set-ids.py pass vip=1234567 autoHarvest=1234568
    python3 scripts/set-ids.py product coinsS=987654 starterPack=987655
    python3 scripts/set-ids.py --check          # list what is still missing

The keys are the `key = "..."` values in Config/Passes.luau and
Config/Products.luau.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGETS = {
    "pass": ROOT / "src/shared/Config/Passes.luau",
    "product": ROOT / "src/shared/Config/Products.luau",
}


def entries(path: Path):
    """Return {key: (id, line_number)} for every entry in a config file."""
    out = {}
    for n, line in enumerate(path.read_text().splitlines(), 1):
        m = re.search(r'key\s*=\s*"([A-Za-z0-9_]+)"\s*,\s*id\s*=\s*(\d+)', line)
        if m:
            out[m.group(1)] = (int(m.group(2)), n)
    return out


def check():
    missing = 0
    for kind, path in TARGETS.items():
        found = entries(path)
        done = {k: v for k, v in found.items() if v[0] != 0}
        todo = sorted(k for k, v in found.items() if v[0] == 0)
        print(f"{kind}: {len(done)}/{len(found)} configurados")
        if todo:
            missing += len(todo)
            print("  faltando: " + ", ".join(todo))
    if missing:
        print(f"\n{missing} ID(s) ainda em 0. Esses itens ficam ocultos/inativos no jogo")
        print("até receberem o ID real (o servidor avisa o jogador em vez de falhar).")
    else:
        print("\nTudo configurado.")
    return 0 if missing == 0 else 1


def assign(kind: str, pairs: list[str]) -> int:
    path = TARGETS.get(kind)
    if not path:
        print(f"tipo inválido: {kind} (use 'pass' ou 'product')")
        return 2
    text = path.read_text()
    found = entries(path)
    changed = 0
    for pair in pairs:
        if "=" not in pair:
            print(f"ignorado (formato esperado chave=id): {pair}")
            continue
        key, raw = pair.split("=", 1)
        key = key.strip()
        if key not in found:
            print(f"!! chave desconhecida em {path.name}: {key}")
            return 2
        try:
            new_id = int(raw.strip())
        except ValueError:
            print(f"!! id inválido para {key}: {raw}")
            return 2
        pattern = re.compile(r'(key\s*=\s*"' + re.escape(key) + r'"\s*,\s*id\s*=\s*)\d+')
        text, count = pattern.subn(lambda m: m.group(1) + str(new_id), text, count=1)
        if count:
            changed += 1
            print(f"  {key} -> {new_id}")
    path.write_text(text)
    print(f"{changed} entrada(s) atualizada(s) em {path.name}")
    return 0


def main() -> int:
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    if args[0] == "--check":
        return check()
    return assign(args[0], args[1:])


if __name__ == "__main__":
    sys.exit(main())
