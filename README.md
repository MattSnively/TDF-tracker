# TDF-Tracker — 2026 Tour de France Dashboard

Interactive dashboard tracking rider performance, stage outcomes, and Tissot
fantasy points for the 2026 Tour de France (July 4–26).

🚀 **Live:** https://mattsnively.github.io/TDF-tracker/

Six tabs: **Overview** (KPIs, jersey holders, top scorers by point source, my
rank), **Stages** (real race result + GC and my official scorecard per stage),
**Riders** (every rider's official points with a click-through source
breakdown), **Teams** (pro-team aggregates), **Value** (cost-vs-points and the
optimal squad), and **My Team** (my actual official squad, rank, and league,
plus a browser-local "build your own" scored by official points).

## Fantasy points come straight from the game

Fantasy points are the **official Tissot scores**, pulled from the game's
authenticated API — they match the game exactly (captain ×2, jersey bonuses,
the Tissot Bonus Question all reconcile). We do **not** recompute points from
rules; an early attempt to do so drifted badly on special stages (e.g. stage 1
was a *team* time trial scored as 1/8 of the team's result).

## Data pipeline

```
Tissot fantasy API (authenticated — Matt's ~30-day JWT)
   │  scripts/scrape_official.py
   ▼
data/official/{stats-latest,journees,myteam,standings}.json + snapshots/
        POST /private/stats          all riders, cumulative points by source
        GET  /private/journee/{n}    stage meta + my rank
        GET  /private/feuillematch/{stage}/{idjg}   my scorecard per stage
        GET  /private/classementgeneral/{league}    standings

letour.fr/en/rankings (public, server-rendered HTML) — the real-race layer
   │  scripts/scrape_letour.py   (stage results, GC, jerseys, time gaps)
   ▼
data/raw/stage-NN/*.json

   both ─▶ scripts/build_data.py ─▶ public/data/tdf.json  (the only file the app loads)
```

`build_data.py` joins official points to `data/riders.csv` (star costs, since
`/private/stats` omits cost) by an accent/ligature-folded name key, and layers
in the letour.fr race results. Per-stage points for all riders come from
day-over-day deltas of the dated `snapshots/`; my own team has exact per-stage
points from `feuillematch`.

### Authentication

`scrape_official.py` needs a bearer JWT from the fantasy site. Grab it from the
browser console on fantasybytissot.letour.fr:

```js
copy(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('jwtToken'))))
```

Save it to `tissot_token.txt` (gitignored) for local runs, and as the
`TISSOT_TOKEN` GitHub secret for CI (`gh secret set TISSOT_TOKEN < tissot_token.txt`).
The token lasts ~30 days; `scrape_official.py` warns when it's within 3 days of
expiry. Refresh by repeating the steps above.

## Updating the data

The [Daily scrape](.github/workflows/daily-scrape.yml) runs 16:30 UTC (11:30 AM
Central) every day of the Tour: official scrape → letour scrape (stage days) →
build → commit → deploy. Off-schedule:

```bash
gh workflow run "Daily stage scrape" --ref main            # auto stage number
gh workflow run "Daily stage scrape" --ref main -f stage=7 # specific stage
```

Manual local run:

```bash
pip install -r requirements.txt
python scripts/scrape_official.py            # needs tissot_token.txt
python scripts/scrape_letour.py --stage 7    # add --no-general when backfilling
python scripts/build_data.py
git add data/ public/data/ && git commit -m "Data update" && git push
```

Watch `build_data.py` for `no cost match` warnings — a rider whose official
name can't be joined to the roster needs a `ROSTER_ALIASES` entry
(scripts/build_data.py).

## Development

```bash
npm install
npm run dev                  # http://localhost:5173
python -m pytest tests/ -q   # roster name-matching + scoring-table tests
```

Deploys happen automatically on push to `main` via
`.github/workflows/deploy.yml` (Pages source must be set to GitHub Actions).

## Notes

- `STAR_BUDGET` in `src/tokens.js` is 120 (confirmed against the live game).
- `scripts/compute_points.py` (rule-based scoring) is retained only for its
  `name_key` roster matcher and its tests; it is no longer the point source.
- letour.fr's general-classification page only shows the latest stage, so a
  past stage's GC/jerseys can't be backfilled later — the daily run captures
  them each evening.
