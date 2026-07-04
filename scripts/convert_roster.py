"""One-time converter: rider list Excel -> data/riders.csv.

The Excel file ("2026 Tour De France Rider List.xlsx") was hand-copied from the
Tissot fantasy game's rider pool, so it carries a few human quirks this script
normalizes:
  - team-name typos (e.g. "Decathalon" -> "Decathlon")
  - inconsistent initial prefixes ("T. Pogacar", "MR. Van Der Poel",
    "Mr Kwiatkowski", "N Vinokurov")

Output columns:
  rider_id      stable slug used as the join key everywhere else (e.g. "t-pogacar")
  display_name  name as it appears in the fantasy game
  last_name     surname(s) with the leading initial(s) stripped, for joining
                against letour.fr results (which list riders as "POGACAR Tadej")
  match_key     accent-folded UPPERCASE last_name — the actual join key used by
                build_data.py when matching scraped results to the roster
  cost          fantasy star cost (5-27)
  category      Leaders | Sprinters | Climbers | All-rounders
  team          pro team name (typo-corrected)

Usage:  python scripts/convert_roster.py [path-to-xlsx]
"""

import csv
import re
import sys
import unicodedata
from pathlib import Path

import openpyxl

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_XLSX = REPO_ROOT / "2026 Tour De France Rider List.xlsx"
OUTPUT_CSV = REPO_ROOT / "data" / "riders.csv"

# Corrections for team-name typos in the hand-entered sheet.
TEAM_FIXES = {
    "Decathalon CMA CGM Team": "Decathlon CMA CGM Team",
    "Caja Rural-Sequros RGA": "Caja Rural-Seguros RGA",
    "Albe": "Alpecin-Premier Tech",  # truncated cell on E. Verstrynge's row
}

# Corrections for rider-name misspellings in the hand-entered sheet
# (applied to the full display name before any other processing).
NAME_FIXES = {
    "V. Paret Painter": "V. Paret-Peintre",  # Valentin Paret-Peintre
    "A. Paret Painter": "A. Paret-Peintre",  # Anthony Paret-Peintre
}

# Leading initial patterns like "T.", "MR.", "Mr.", "Mr", "N" before the surname.
INITIAL_PREFIX = re.compile(r"^[A-Za-z]{1,2}\.?\s+")


def fold_accents(text: str) -> str:
    """Strip diacritics so 'Vinokurov' matches 'Vinokúrov' etc."""
    return "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )


def slugify(text: str) -> str:
    """Lowercase accent-free slug: 'T. Pogacar' -> 't-pogacar'."""
    text = fold_accents(text).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def split_name(display_name: str) -> str:
    """Return the surname portion by stripping the leading initial(s)."""
    return INITIAL_PREFIX.sub("", display_name).strip()


def main() -> None:
    xlsx_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    # read_only mode works even while the workbook is open in Excel.
    wb = openpyxl.load_workbook(xlsx_path, read_only=True)
    ws = wb["Sheet1"]
    rows = list(ws.iter_rows(values_only=True))

    header = rows[0]
    assert header == ("Rider", "Points", "Category", "Team"), f"Unexpected header: {header}"

    riders = []
    seen_ids: set[str] = set()
    for rider, cost, category, team in rows[1:]:
        if rider is None:
            continue  # skip blank rows
        rider = str(rider).strip()
        rider = NAME_FIXES.get(rider, rider)
        team = TEAM_FIXES.get(str(team).strip(), str(team).strip())
        last_name = split_name(rider)

        rider_id = slugify(rider)
        # Guard against slug collisions (two riders with same initial + surname).
        if rider_id in seen_ids:
            rider_id = f"{rider_id}-{slugify(team)[:8]}"
        seen_ids.add(rider_id)

        riders.append(
            {
                "rider_id": rider_id,
                "display_name": rider,
                "last_name": last_name,
                "match_key": fold_accents(last_name).upper(),
                "cost": int(cost),
                "category": str(category).strip(),
                "team": team,
            }
        )

    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(riders[0].keys()))
        writer.writeheader()
        writer.writerows(riders)

    print(f"Wrote {len(riders)} riders -> {OUTPUT_CSV}")
    # Sanity summary: category and cost distribution should match the sheet.
    from collections import Counter

    print("Categories:", dict(Counter(r["category"] for r in riders)))
    print("Teams:", len({r["team"] for r in riders}))


if __name__ == "__main__":
    main()
