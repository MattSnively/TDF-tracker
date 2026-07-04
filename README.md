# TDF-Tracker — 2026 Tour de France Dashboard

Interactive dashboard tracking rider performance, stage outcomes, and Tissot
fantasy points for the 2026 Tour de France (July 4–26).

🚀 **Live:** https://mattsnively.github.io/TDF-tracker/

Six tabs: **Overview** (jerseys, KPIs, points race), **Stages** (per-stage
results and fantasy hauls), **Riders** (sortable table with stage-by-stage
breakdowns), **Teams** (pro-team aggregates), **Value** (cost-vs-points and
the optimal squad), and **My Team** (a browser-local team builder — pick 8
riders under the game's budget and category caps, choose a captain, and track
your score; saved in localStorage, no account needed).

## Stack

- **React 18** + **Vite 5** + **Tailwind CSS** + **Recharts**
- **Python** (requests + BeautifulSoup) for the data pipeline
- **GitHub Actions** for the nightly scrape and GitHub Pages deploys

## Data pipeline

```
letour.fr/en/rankings (official classifications, server-rendered HTML)
   │  scripts/scrape_letour.py   — nightly per stage, all classifications
   ▼
data/raw/stage-NN/{ite,ipe,ime,ije,ete,ice,itg,ipg,img,ijg,etg,icg}.json
   │  scripts/compute_points.py  — Tissot scoring rules → fantasy points
   ▼
data/points.json
   │  scripts/build_data.py      — join with data/riders.csv roster
   ▼
public/data/tdf.json             — the only file the dashboard loads
```

The roster (`data/riders.csv`) came from the Tissot fantasy game's rider pool
via `scripts/convert_roster.py` (184 riders: star cost, category, team).
`scripts/scrape_tissot.py` snapshots the game's public API (clubs, rules, and
the rider pool endpoint) for cross-checking.

### Classification codes (letour.fr)

Stage-level: `ite` stage result · `ipe` intermediate sprint · `ime` KOM points
won in-stage · `ije` youth · `ete` team · `ice` combativity. General (evening
standings, scraped same night): `itg` GC · `ipg` points · `img` KOM · `ijg`
youth · `etg` team · `icg` super-combativity.

### Fantasy scoring

Computed from the published Tissot rules (snapshot in
`data/reference/rules.json`, tables in `scripts/compute_points.py`):

- **Stage finish** 200/150/120/…/1 (1st→100th) · **intermediate sprint**
  30/25/20/…/2 (1st→15th, from `ipe` order) · **col points** = official KOM
  points won in-stage (the official TdF per-col scale is identical to
  Tissot's) · **combativity** 30 (stages 1–20)
- **Evening jersey bonuses** — GC 50/45/…/1 (→100th), points & KOM 30/26/…/1
  (→15th), youth 20/18/…/1 (→15th); **×3 on stage 21**; super-combativity 90
  on stage 21
- **Known gap:** breakaway-kilometre points (1/km in the lead group) aren't
  published in official classifications and are omitted — flagged in the
  dashboard footer.

## Updating the data

The [Daily stage scrape](.github/workflows/daily-scrape.yml) runs every Tour
evening at 19:45 UTC: scrape → compute → build → commit (`Stage N data`) →
trigger deploy. Run it off-schedule with:

```bash
gh workflow run "Daily stage scrape" --ref main            # auto stage number
gh workflow run "Daily stage scrape" --ref main -f stage=7 # specific stage
```

Manual fallback:

```bash
pip install -r requirements.txt
python scripts/scrape_letour.py --stage 7   # add --no-general when backfilling
python scripts/compute_points.py
python scripts/build_data.py
git add data/ public/data/ && git commit -m "Stage 7 data" && git push
```

Watch the build_data output for `unmatched result names` warnings — a rider
scoring points who can't be joined to the roster needs an entry in `ALIASES`
(scripts/build_data.py).

## Development

```bash
npm install
npm run dev            # http://localhost:5173
python -m pytest tests/ -q   # scoring-engine tests (2025 stage-1 fixture)
```

Deploys happen automatically on push to `main` via
`.github/workflows/deploy.yml` (Pages source must be set to GitHub Actions in
repo settings).

## Notes

- `STAR_BUDGET` in `src/tokens.js` is 100 (the platform standard); the rules
  text doesn't state the number — verify against the live game.
- The general-classification pages only show the *latest* standings, so the
  nightly scrape is also the historical record: a missed night should be
  re-run with `--no-general` for the stage tables, and the evening GC snapshot
  for that stage is lost (jersey bonuses for that stage would need the
  Playwright fallback or manual entry).
