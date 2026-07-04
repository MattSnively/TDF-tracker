"""Compute Tissot fantasy points per rider per stage from scraped raw data.

Scoring model (from the game's official rules, data/reference/rules.json —
see README for the full extraction):

STAGE POINTS (doubled for a player's Shimano Bonus captain):
  - Stage finish position   -> STAGE_FINISH table (1st=200 ... 100th=1)
  - Intermediate sprint     -> SPRINT table applied to the ipe ranking order
                               (modern Tours have exactly one intermediate
                               sprint per road stage, so ipe order = sprint order)
  - Col summits             -> the official TdF KOM scale per col is IDENTICAL
                               to Tissot's col table (HC 20/15/12/10/8/6/4/2,
                               C1 10/8/6/4/2/1, C2 5/3/2/1, C3 2/1, C4 1), so a
                               rider's Tissot col points = the KOM points they
                               earned in-stage = the ime "Points" column.
  - Stage combativity       -> 30 pts (stages 1-20 only, from ice)

JERSEY BONUSES (evening of each stage; NOT doubled by captain; x3 on stage 21):
  - GC (itg)     -> GC_BONUS
  - Points (ipg) -> POINTS_BONUS
  - KOM (img)    -> KOM_BONUS (same table as points)
  - Youth (ijg)  -> YOUTH_BONUS
  - Super-combativity of the Tour (stage 21 only): 90 pts

KNOWN LIMITATION (documented in README + dashboard footnote): the game also
awards 1 pt per km ridden in the lead breakaway group. That data is not
published in official classifications, so it is omitted here. Totals for
breakaway riders will read slightly low vs the official game.

Output: data/points.json
  { "stages": [n, ...],
    "riders": { match_key: { "stage": {n: pts}, "bonus": {n: pts},
                             "detail": {n: {finish, sprint, col, combativity,
                                            gc, points, kom, youth}} } } }

Usage: python scripts/compute_points.py
"""

import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = REPO_ROOT / "data" / "raw"
OUTPUT = REPO_ROOT / "data" / "points.json"

FINAL_STAGE = 21  # jersey bonuses x3, super-combativity awarded, no stage combativity


def rank_table(pairs: list[tuple[range, int]]) -> dict[int, int]:
    """Expand [(rank-range, points), ...] into a flat {rank: points} map."""
    table = {}
    for ranks, pts in pairs:
        for r in ranks:
            table[r] = pts
    return table


# Stage finish position -> points (1st through 100th).
STAGE_FINISH = rank_table([
    (range(1, 2), 200), (range(2, 3), 150), (range(3, 4), 120), (range(4, 5), 100),
    (range(5, 6), 90), (range(6, 7), 80), (range(7, 8), 70), (range(8, 9), 65),
    (range(9, 10), 60), (range(10, 11), 55), (range(11, 12), 50), (range(12, 13), 45),
    (range(13, 14), 40), (range(14, 15), 35), (range(15, 16), 30), (range(16, 17), 25),
    (range(17, 18), 20), (range(18, 19), 15), (range(19, 20), 10), (range(20, 21), 9),
    (range(21, 26), 8), (range(26, 31), 7), (range(31, 36), 6), (range(36, 41), 5),
    (range(41, 51), 4), (range(51, 61), 3), (range(61, 81), 2), (range(81, 101), 1),
])

# Intermediate sprint order -> points (1st through 15th).
SPRINT = rank_table([
    (range(1, 2), 30), (range(2, 3), 25), (range(3, 4), 20), (range(4, 5), 18),
    (range(5, 6), 16), (range(6, 7), 14), (range(7, 8), 12), (range(8, 9), 10),
    (range(9, 10), 8), (range(10, 11), 7), (range(11, 12), 6), (range(12, 13), 5),
    (range(13, 14), 4), (range(14, 15), 3), (range(15, 16), 2),
])

# Evening GC position -> bonus points (1st through 100th).
GC_BONUS = rank_table([
    (range(1, 2), 50), (range(2, 3), 45), (range(3, 4), 40), (range(4, 5), 35),
    (range(5, 6), 30), (range(6, 7), 28), (range(7, 8), 26), (range(8, 9), 24),
    (range(9, 10), 22), (range(10, 11), 21), (range(11, 12), 20), (range(12, 13), 19),
    (range(13, 14), 18), (range(14, 15), 17), (range(15, 16), 16), (range(16, 17), 15),
    (range(17, 18), 14), (range(18, 19), 13), (range(19, 20), 12), (range(20, 21), 11),
    (range(21, 26), 10), (range(26, 31), 9), (range(31, 36), 8), (range(36, 41), 7),
    (range(41, 46), 6), (range(46, 51), 5), (range(51, 61), 4), (range(61, 71), 3),
    (range(71, 81), 2), (range(81, 101), 1),
])

# Evening points/KOM classification position -> bonus (1st through 15th).
POINTS_BONUS = rank_table([
    (range(1, 2), 30), (range(2, 3), 26), (range(3, 4), 22), (range(4, 5), 20),
    (range(5, 6), 18), (range(6, 7), 16), (range(7, 8), 14), (range(8, 9), 12),
    (range(9, 10), 10), (range(10, 11), 8), (range(11, 12), 6), (range(12, 13), 4),
    (range(13, 14), 3), (range(14, 15), 2), (range(15, 16), 1),
])
KOM_BONUS = POINTS_BONUS

# Evening youth classification position -> bonus (1st through 15th).
YOUTH_BONUS = rank_table([
    (range(1, 2), 20), (range(2, 3), 18), (range(3, 4), 16), (range(4, 5), 14),
    (range(5, 6), 12), (range(6, 7), 10), (range(7, 8), 9), (range(8, 9), 8),
    (range(9, 10), 7), (range(10, 11), 6), (range(11, 12), 5), (range(12, 13), 4),
    (range(13, 14), 3), (range(14, 15), 2), (range(15, 16), 1),
])

COMBATIVITY_PTS = 30       # stage combativity, stages 1-20
SUPER_COMBATIVITY_PTS = 90  # awarded once, on the final stage


def name_key(raw_name: str) -> str:
    """Normalize a rider name ('J. PHILIPSEN') to an 'initial|SURNAME' join key.

    The first letter of the initial is kept because surnames alone collide
    (e.g. the Johannessen twins, both at Uno-X). Hyphens fold to spaces and
    whitespace collapses so 'PARET-PEINTRE' matches 'Paret-Peintre'. Returns
    e.g. 'J|PHILIPSEN'. build_data.py owns the fuzzier roster-side matching
    (accent folding, surname-prefix fallback for legal-name differences like
    'Vingegaard Hansen' vs 'VINGEGAARD').
    """
    raw = raw_name.strip()
    m = re.match(r"^([A-Za-z]{1,2})\.?\s+(.*)$", raw)
    initial, surname = (m.group(1)[0], m.group(2)) if m else ("", raw)
    surname = re.sub(r"[\s-]+", " ", surname).strip().upper()
    return f"{initial.upper()}|{surname}"


def load(stage_dir: Path, code: str) -> list[dict]:
    """Load one classification's rows for a stage; [] if the file is absent."""
    path = stage_dir / f"{code}.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))["rows"]


def points_value(row: dict) -> int:
    """Parse the 'Points' cell ('20 PTS') to an int."""
    m = re.search(r"\d+", row.get("Points", ""))
    return int(m.group(0)) if m else 0


def compute_stage(stage_dir: Path, stage_num: int) -> dict[str, dict]:
    """Return {rider_key: {"stage": pts, "bonus": pts, "detail": {...}}} for one stage."""
    riders: dict[str, dict] = {}

    def entry(raw_name: str) -> dict:
        key = name_key(raw_name)
        return riders.setdefault(
            key, {"stage": 0, "bonus": 0, "detail": {}, "display": raw_name}
        )

    def add(raw_name: str, bucket: str, component: str, pts: int) -> None:
        if pts <= 0:
            return
        e = entry(raw_name)
        e[bucket] += pts
        e["detail"][component] = e["detail"].get(component, 0) + pts

    # --- stage points ---
    for row in load(stage_dir, "ite"):
        if row["rank"]:
            add(row["name"], "stage", "finish", STAGE_FINISH.get(row["rank"], 0))
    for row in load(stage_dir, "ipe"):
        if row["rank"]:
            add(row["name"], "stage", "sprint", SPRINT.get(row["rank"], 0))
    for row in load(stage_dir, "ime"):
        # Official in-stage KOM points == Tissot col points (identical scales).
        add(row["name"], "stage", "col", points_value(row))
    if stage_num < FINAL_STAGE:
        for row in load(stage_dir, "ice"):
            if row["rank"] == 1:
                add(row["name"], "stage", "combativity", COMBATIVITY_PTS)

    # --- jersey bonuses (evening standings; x3 on the final stage) ---
    mult = 3 if stage_num == FINAL_STAGE else 1
    for code, table, component in [
        ("itg", GC_BONUS, "gc"),
        ("ipg", POINTS_BONUS, "points"),
        ("img", KOM_BONUS, "kom"),
        ("ijg", YOUTH_BONUS, "youth"),
    ]:
        for row in load(stage_dir, code):
            if row["rank"]:
                add(row["name"], "bonus", component, table.get(row["rank"], 0) * mult)

    # Super-combativity of the Tour, final stage only (not multiplied).
    if stage_num == FINAL_STAGE:
        for row in load(stage_dir, "icg"):
            if row["rank"] == 1:
                add(row["name"], "bonus", "super_combativity", SUPER_COMBATIVITY_PTS)

    return riders


def main() -> None:
    stages = sorted(
        int(p.name.split("-")[1]) for p in RAW_DIR.glob("stage-*") if p.is_dir()
    )
    result: dict = {"stages": stages, "riders": {}}
    for n in stages:
        stage_riders = compute_stage(RAW_DIR / f"stage-{n:02d}", n)
        for key, vals in stage_riders.items():
            r = result["riders"].setdefault(
                key, {"display": vals["display"], "stage": {}, "bonus": {}, "detail": {}}
            )
            r["stage"][str(n)] = vals["stage"]
            r["bonus"][str(n)] = vals["bonus"]
            r["detail"][str(n)] = vals["detail"]

    OUTPUT.write_text(
        json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    total_riders = len(result["riders"])
    print(f"Computed points for {total_riders} riders across stages {stages} -> {OUTPUT}")


if __name__ == "__main__":
    main()
