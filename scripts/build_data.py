"""Build the packed dashboard dataset from OFFICIAL Tissot data + the letour.fr
race layer -> public/data/tdf.json (the only file the app loads).

Sources:
  data/official/stats-latest.json   all riders, official cumulative points by
                                     source (the authoritative fantasy numbers)
  data/official/journees.json        stage names/types + Matt's rank per stage
  data/official/myteam.json          Matt's scorecard per stage (feuillematch)
  data/official/standings.json       league standings
  data/official/snapshots/*.json     dated stats -> per-stage point deltas
  data/riders.csv                    star cost + category (from the fantasy game
                                     rider list; official stats omits cost)
  data/raw/stage-NN/*.json           letour.fr race results (podiums, jerseys,
                                     time gaps) — the real-race layer

Rider identity: official `nom`/`nomaffiche` join to the roster via an
accent-folded INITIAL|SURNAME key (compute_points.name_key), the same matcher
used across the project. Bib is carried through for the letour join.

Output shape (see the README for the field-by-field contract):
  meta, teams, riders[], stages[], myTeam
"""

import csv
import json
import sys
import unicodedata
from datetime import datetime, UTC
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compute_points import name_key  # shared roster-matching key

REPO_ROOT = Path(__file__).resolve().parent.parent
OFFICIAL = REPO_ROOT / "data" / "official"
RAW_DIR = REPO_ROOT / "data" / "raw"
ROSTER_CSV = REPO_ROOT / "data" / "riders.csv"
OUTPUT = REPO_ROOT / "public" / "data" / "tdf.json"

# Official position id -> category label (from stats "positions").
POSITION_LABELS = {"43": "Leaders", "44": "All-rounders", "45": "Climbers", "46": "Sprinters"}

# criteres -> grouped point sources for the breakdown display.
# (critere_1 finish, 2 sprint, 3-7 climbs HC..cat4, 8 breakaway km, 9 combativity,
#  10 yellow/GC, 11 green/points, 12 polka/KOM, 13 white/youth, 14 super-combativity)
BREAKDOWN_GROUPS = {
    "finishes": ["critere_1"],
    "climbsSprints": ["critere_2", "critere_3", "critere_4", "critere_5", "critere_6", "critere_7", "critere_8"],
    "combativity": ["critere_9", "critere_14"],
    "gc": ["critere_10"],
    "points": ["critere_11"],
    "kom": ["critere_12"],
    "youth": ["critere_13"],
}


# Ligatures/letters that NFKD does not decompose, so the accent-fold misses
# them (official spelling uses the real glyph; the hand-typed roster spells it
# out). Mapped before folding so both sides normalize identically.
LIGATURES = str.maketrans(
    {"Æ": "AE", "æ": "ae", "Ø": "O", "ø": "o", "Œ": "OE", "œ": "oe",
     "Ð": "D", "ð": "d", "Þ": "TH", "þ": "th", "ß": "ss", "Ł": "L", "ł": "l", "’": "", "'": ""}
)


def fold(text: str) -> str:
    """Accent-fold plus ligature/apostrophe normalization for name matching."""
    text = text.translate(LIGATURES)
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))


def load_json(path: Path, default=None):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def to_int(v) -> int:
    return int(v) if str(v).lstrip("-").isdigit() else 0


def load_raw(stage_dir: Path, code: str) -> list[dict]:
    p = stage_dir / f"{code}.json"
    return load_json(p, {"rows": []})["rows"] if p.exists() else []


# Official rider -> roster spelling for hand-typed roster typos the fold can't
# bridge (official spelling is authoritative; the roster carries the star cost).
ROSTER_ALIASES = {
    "M|SKJELMOSE": "Mr. Skjelmosse",
    "J|BERCKMOES": "J. Beckermoes",
    "P|HAGENES": "P. Gahenes",
    "A|BAUDIN": "A. Abaudin",
    "N|BREUILLARD": "N. Breullard",
    "B|VAN LERBERGHE": "B. Ban Lerberghe",
}


class RosterIndex:
    """Attach star cost + category from riders.csv to official riders by name."""

    def __init__(self, roster: list[dict]):
        self.by_key = {fold(name_key(r["display_name"])): r for r in roster}
        self.by_display = {r["display_name"]: r for r in roster}
        self.misses: list[str] = []

    def cost_cat(self, nomaffiche: str, position: str):
        key = fold(name_key(nomaffiche))
        r = self.by_key.get(key)
        if r is None and key in ROSTER_ALIASES:
            r = self.by_display.get(ROSTER_ALIASES[key])
        if r:
            return int(r["cost"]), r["category"]
        # Fall back to the official category; cost unknown (rare — flag it).
        self.misses.append(nomaffiche)
        return None, POSITION_LABELS.get(position, "")


def build_riders(stats: dict, roster_idx: RosterIndex, teams_idx: dict, deltas: dict):
    """One record per official rider: identity, cost, official total + breakdown."""
    riders = []
    for j in stats.get("joueurs", []):
        crit = {c["nom"]: c["value"] for c in j["criteres"]}
        total = sum(to_int(crit.get(k)) for grp in BREAKDOWN_GROUPS.values() for k in grp)
        nb = to_int(crit.get("nb_matchs"))
        breakdown = {
            name: sum(to_int(crit.get(k)) for k in keys) for name, keys in BREAKDOWN_GROUPS.items()
        }
        cost, cat = roster_idx.cost_cat(j["nomaffiche"], j["position"])
        team = j["club"]
        riders.append(
            {
                "id": fold(name_key(j["nomaffiche"])).lower().replace("|", "-"),
                "name": j["nomaffiche"],
                "bib": j["bib"],
                "cost": cost,
                "cat": cat,
                "team": teams_idx[team],
                "total": total,
                "avg": round(total / nb, 1) if nb else 0,
                "nbMatchs": nb,
                "breakdown": breakdown,
                "stagePts": deltas.get(j["bib"], {}),  # per-stage from snapshot deltas
            }
        )
    return sorted(riders, key=lambda r: -r["total"])


def compute_deltas(snap_dir: Path) -> dict:
    """Per-stage points per rider (keyed by bib) from consecutive daily snapshots.

    Each snapshot is cumulative-through-that-day; the delta between two days that
    straddle a stage is that stage's points. With a single snapshot so far this
    is empty and the dashboard shows cumulative only — it fills in daily.
    """
    snaps = sorted(snap_dir.glob("stats-*.json"))
    if len(snaps) < 2:
        return {}

    def totals(path):
        d = load_json(path)
        out = {}
        for j in d.get("joueurs", []):
            crit = {c["nom"]: c["value"] for c in j["criteres"]}
            out[j["bib"]] = (
                sum(to_int(crit.get(k)) for grp in BREAKDOWN_GROUPS.values() for k in grp),
                to_int(crit.get("nb_matchs")),
            )
        return out

    deltas: dict = {}
    prev = totals(snaps[0])
    for path in snaps[1:]:
        cur = totals(path)
        for bib, (tot, nb) in cur.items():
            ptot, pnb = prev.get(bib, (0, 0))
            if nb > pnb:  # a stage completed between the two snapshots
                deltas.setdefault(bib, {})[str(nb)] = tot - ptot
        prev = cur
    return deltas


def build_stages(journees: list[dict], roster_by_bib: dict) -> list[dict]:
    """Race-results layer from letour.fr, annotated with official stage names/type."""

    def ref(row):
        return {"name": row["name"].title(), "team": row["team"].title(), "bib": row.get("bib", "")}

    jmeta = {int(j["numero"]): j for j in journees}
    stages = []
    for jn in sorted(jmeta):
        j = jmeta[jn]
        if not j.get("fantasy", {}).get("passed"):
            continue
        sd = RAW_DIR / f"stage-{jn:02d}"
        ite = load_raw(sd, "ite") or load_raw(sd, "itg")  # stage result, or GC for a TTT/stage-1
        itg = load_raw(sd, "itg")
        jerseys = {}
        for code, key in [("itg", "gc"), ("ipg", "points"), ("img", "kom"), ("ijg", "youth")]:
            rows = load_raw(sd, code)
            if rows:
                jerseys[key] = ref(rows[0])
        comb = load_raw(sd, "ice") or load_raw(sd, "icg")
        stages.append(
            {
                "n": jn,
                "name": j.get("nom", f"Stage {jn}"),
                "info": j.get("infos", ""),
                "myRank": j.get("positionjoueur"),
                "top10": [{**ref(r), "time": r.get("Times", ""), "gap": r.get("Gap", "")} for r in ite[:10]],
                "gcTop10": [{**ref(r), "gap": r.get("Gap", "")} for r in itg[:10]],
                "jerseys": jerseys,
                "combativity": ref(comb[0]) if comb else None,
                "finishers": sum(1 for r in ite if r.get("rank")),
            }
        )
    return stages


def build_myteam(myteam: dict, standings: dict) -> dict:
    """Matt's official squad + score per stage, plus league standings."""
    stages = {}
    for n, sheet in sorted(myteam.items(), key=lambda kv: int(kv[0])):
        postes = sheet.get("feuille", {}).get("postes", [])
        riders = [
            {
                "name": p["nomcomplet"],
                "bib": p["bib"],
                "points": to_int(p.get("points")),
                "captain": str(p.get("capitaine")) in ("1", "True", "true"),
                "cost": to_int(p.get("valeur")),
            }
            for p in postes
        ]
        # Tissot Bonus Question (time-trial guess etc.) — a per-player bonus.
        bonus = 0
        for q in sheet.get("feuille", {}).get("questions_additionnelles", []):
            pts = q.get("points")
            if isinstance(pts, dict):
                bonus += to_int(pts.get("gagnes"))
        riders_total = sum(r["points"] for r in riders)
        stages[n] = {
            "riders": riders,
            "bonusQuestion": bonus,
            "ridersTotal": riders_total,
            "total": riders_total + bonus,
        }
    standings_rows = [
        {
            "manager": p.get("manager"),
            "position": to_int(p.get("position")),
            "total": float(p.get("totaljoueur") or 0),
            "me": bool(p.get("moi")),
        }
        for p in standings.get("joueurs", [])
    ]
    return {"stages": stages, "standings": sorted(standings_rows, key=lambda x: x["position"])}


def main() -> None:
    stats = load_json(OFFICIAL / "stats-latest.json", {"joueurs": [], "positions": []})
    journees = load_json(OFFICIAL / "journees.json", [])
    myteam = load_json(OFFICIAL / "myteam.json", {})
    standings = load_json(OFFICIAL / "standings.json", {"joueurs": []})
    roster = list(csv.DictReader(open(ROSTER_CSV, encoding="utf-8")))
    roster_idx = RosterIndex(roster)

    # Teams come from the official club list on each rider.
    teams = sorted({j["club"] for j in stats.get("joueurs", [])})
    teams_idx = {t: i for i, t in enumerate(teams)}

    deltas = compute_deltas(OFFICIAL / "snapshots")
    riders = build_riders(stats, roster_idx, teams_idx, deltas)
    roster_by_bib = {r["bib"]: r for r in riders}
    stages = build_stages(journees, roster_by_bib)
    my = build_myteam(myteam, standings)

    completed = [s["n"] for s in stages]
    out = {
        "meta": {
            "builtAt": datetime.now(UTC).isoformat(timespec="seconds"),
            "source": "official",
            "stagesComplete": completed,
            "asOfStage": max(completed) if completed else 0,
            "note": (
                "Fantasy points are the official Tissot game scores. Per-rider "
                "totals are cumulative; per-stage figures appear as daily "
                "snapshots accumulate."
            ),
        },
        "teams": teams,
        "riders": riders,
        "stages": stages,
        "myTeam": my,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(
        f"Wrote {OUTPUT.relative_to(REPO_ROOT)}: {len(riders)} riders, "
        f"{len(stages)} stages, {OUTPUT.stat().st_size // 1024} KB"
    )
    if roster_idx.misses:
        print(f"WARNING — {len(roster_idx.misses)} riders had no cost match:")
        for m in roster_idx.misses[:20]:
            print(f"  {m}")


if __name__ == "__main__":
    main()
