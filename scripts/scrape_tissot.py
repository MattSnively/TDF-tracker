"""Snapshot the Tissot fantasy game's PUBLIC API endpoints.

The fantasy platform exposes a small REST API at
https://fantasybytissot.letour.fr/v1 authenticated only by a static
X-Access-Key header of the form "{identity}@{version}" (both values are
published in the site's own assets/client/card-game.js — no account needed).

We snapshot:
  /public/clubs     -> data/reference/tissot_clubs.json   (team ids + labels)
  /public/sportifs  -> data/reference/tissot_sportifs.json (rider pool; empty
                       before the game goes live — if it populates, it gives
                       official rider ids and star costs to cross-check our
                       hand-entered roster)
  /public/reglesjeu -> data/reference/rules.json           (scoring rules text)

Run occasionally (it's cheap); the daily workflow runs it so we notice if the
sportifs endpoint starts returning data mid-race.

Usage: python scripts/scrape_tissot.py
"""

import json
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
REF_DIR = REPO_ROOT / "data" / "reference"

API_BASE = "https://fantasybytissot.letour.fr/v1"
# identity@version from assets/client/card-game.js on the fantasy site.
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "X-Access-Key": "630@19.30",
    "Accept": "application/json",
}

ENDPOINTS = {
    "/public/clubs": "tissot_clubs.json",
    "/public/sportifs": "tissot_sportifs.json",
    "/public/reglesjeu": "rules.json",
}


def main() -> None:
    REF_DIR.mkdir(parents=True, exist_ok=True)
    for path, filename in ENDPOINTS.items():
        resp = requests.get(API_BASE + path, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        out = REF_DIR / filename
        out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        # Crude size signal so the workflow log shows when sportifs goes live.
        n = len(next(iter(data.values()))) if isinstance(data, dict) and data else 0
        print(f"{path} -> {out.name} ({n} items)")


if __name__ == "__main__":
    main()
