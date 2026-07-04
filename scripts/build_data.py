"""Build the packed dashboard dataset: roster + raw results + fantasy points
-> public/data/tdf.json (the only file the React app consumes).

Join strategy (roster riders.csv <-> letour.fr result names):
  Both sides normalize to an accent-folded 'INITIAL|SURNAME' key via
  compute_points.name_key. Exact key match first; then a fallback for
  legal-name mismatches (roster 'J|VINGEGAARD HANSEN' vs letour
  'J|VINGEGAARD'): same initial + one surname is a prefix of the other,
  accepted only when the candidate is unique. Unmatched result names are
  printed as warnings so gaps surface in the daily workflow log and can be
  fixed by adding an entry to ALIASES.

Output shape (kept small; ~184 riders x 21 stages):
  meta    { builtAt, stagesComplete, breakawayNote }
  teams   [ team name, ... ]                      riders reference by index
  riders  [ { id, name, last, cost, cat, team, total,
              pts:    { "N": stage+bonus points for stage N },
              split:  { "N": [stagePts, bonusPts] },
              detail: { "N": {finish, sprint, col, combativity, gc, ...} },
              ranks:  { "N": [stageFinishRank, gcRankAfterStage] } } ]
  stages  [ { n, top10: [{id, name, team, time, gap}], combativity,
              jerseys: {gc, points, kom, youth},      riders by id (or raw name)
              gcTop10: [{id, name, gap}], teamTop5: [names],
              finishers } ]

Usage: python scripts/build_data.py
"""

import csv
import json
import sys
import unicodedata
from datetime import datetime, UTC
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compute_points import name_key  # single source of truth for name keys

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = REPO_ROOT / "data" / "raw"
ROSTER_CSV = REPO_ROOT / "data" / "riders.csv"
POINTS_JSON = REPO_ROOT / "data" / "points.json"
OUTPUT = REPO_ROOT / "public" / "data" / "tdf.json"

# Manual overrides for names the automatic matcher can't pair:
# letour-side folded key -> roster rider_id.
ALIASES: dict[str, str] = {}

BREAKAWAY_NOTE = (
    "Fantasy points are computed from official classifications using the "
    "published Tissot scoring rules. Breakaway-kilometre points (1/km in the "
    "lead group) are not published in official results and are not included."
)


def fold(text: str) -> str:
    """Accent-fold: 'INTERMARCHÉ' -> 'INTERMARCHE'."""
    return "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )


def load_rows(stage_dir: Path, code: str) -> list[dict]:
    path = stage_dir / f"{code}.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))["rows"]


class RosterIndex:
    """Resolves letour.fr rider names to roster rider_ids."""

    def __init__(self, roster: list[dict]):
        self.by_key = {fold(name_key(r["display_name"])): r for r in roster}
        self.roster = roster
        self.misses: set[str] = set()

    def resolve(self, raw_name: str) -> str | None:
        key = fold(name_key(raw_name))
        if key in ALIASES:
            return ALIASES[key]
        hit = self.by_key.get(key)
        if hit:
            return hit["rider_id"]
        # Fallback: same initial, surname prefix relationship, unique candidate.
        initial, _, surname = key.partition("|")
        candidates = []
        for k, r in self.by_key.items():
            ri, _, rs = k.partition("|")
            if ri == initial and (rs.startswith(surname) or surname.startswith(rs)):
                candidates.append(r)
        if len(candidates) == 1:
            return candidates[0]["rider_id"]
        self.misses.add(raw_name)
        return None


def main() -> None:
    roster = list(csv.DictReader(open(ROSTER_CSV, encoding="utf-8")))
    index = RosterIndex(roster)
    points = (
        json.loads(POINTS_JSON.read_text(encoding="utf-8"))
        if POINTS_JSON.exists()
        else {"stages": [], "riders": {}}
    )

    teams = sorted({r["team"] for r in roster})
    team_idx = {t: i for i, t in enumerate(teams)}

    riders_out = {
        r["rider_id"]: {
            "id": r["rider_id"],
            "name": r["display_name"],
            "last": r["last_name"],
            "cost": int(r["cost"]),
            "cat": r["category"],
            "team": team_idx[r["team"]],
            "total": 0,
            "pts": {},
            "split": {},
            "detail": {},
            "ranks": {},
        }
        for r in roster
    }

    # Fold computed fantasy points into roster riders.
    for letour_key, p in points["riders"].items():
        rid = index.resolve(p["display"])
        if rid is None:
            continue
        r = riders_out[rid]
        for n in p["stage"]:
            stage_pts = p["stage"][n]
            bonus_pts = p["bonus"].get(n, 0)
            r["pts"][n] = stage_pts + bonus_pts
            r["split"][n] = [stage_pts, bonus_pts]
            r["detail"][n] = p["detail"].get(n, {})
        r["total"] = sum(r["pts"].values())

    # Per-stage metadata + per-rider ranks from the raw classification files.
    stages_out = []
    for n in points["stages"]:
        stage_dir = RAW_DIR / f"stage-{n:02d}"
        ite = load_rows(stage_dir, "ite")
        itg = load_rows(stage_dir, "itg")

        def rider_ref(row: dict) -> dict:
            rid = index.resolve(row["name"])
            return {"id": rid, "name": row["name"].title(), "team": row["team"].title()}

        for row in ite:
            rid = index.resolve(row["name"])
            if rid and row["rank"]:
                riders_out[rid]["ranks"].setdefault(str(n), [None, None])[0] = row["rank"]
        for row in itg:
            rid = index.resolve(row["name"])
            if rid and row["rank"]:
                riders_out[rid]["ranks"].setdefault(str(n), [None, None])[1] = row["rank"]

        jerseys = {}
        for code, jersey in [("itg", "gc"), ("ipg", "points"), ("img", "kom"), ("ijg", "youth")]:
            rows = load_rows(stage_dir, code)
            if rows:
                jerseys[jersey] = rider_ref(rows[0])

        combativity = load_rows(stage_dir, "ice")
        stages_out.append(
            {
                "n": n,
                "top10": [
                    {**rider_ref(row), "time": row.get("Times", ""), "gap": row.get("Gap", "")}
                    for row in ite[:10]
                ],
                "combativity": rider_ref(combativity[0]) if combativity else None,
                "jerseys": jerseys,
                "gcTop10": [
                    {**rider_ref(row), "gap": row.get("Gap", "")} for row in itg[:10]
                ],
                "teamTop5": [row["team"].title() for row in load_rows(stage_dir, "etg")[:5]],
                "finishers": sum(1 for row in ite if row["rank"]),
            }
        )

    out = {
        "meta": {
            "builtAt": datetime.now(UTC).isoformat(timespec="seconds"),
            "stagesComplete": points["stages"],
            "breakawayNote": BREAKAWAY_NOTE,
        },
        "teams": teams,
        "riders": list(riders_out.values()),
        "stages": stages_out,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(
        f"Wrote {OUTPUT.relative_to(REPO_ROOT)}: {len(roster)} riders, "
        f"{len(stages_out)} stages, {OUTPUT.stat().st_size // 1024} KB"
    )
    if index.misses:
        print("WARNING — unmatched result names (add to ALIASES if they should score):")
        for name in sorted(index.misses):
            print(f"  {name}")


if __name__ == "__main__":
    main()
