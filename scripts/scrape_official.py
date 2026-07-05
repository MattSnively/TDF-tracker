"""Pull official fantasy data from the authenticated Tissot API.

This is the source of truth for fantasy points: the numbers exactly match what
the game shows (verified against Matt's team report — captain doubling, jersey
bonuses, and the Tissot Bonus Question all reconcile).

Auth: a bearer JWT (Matt's) in the TISSOT_TOKEN env var, or a local
`.tissot_token` file. Sent as `Authorization: Token <jwt>` plus the static
`X-Access-Key: 630@19.30` (identity@version from the site's card-game.js). The
JWT is long-lived (~30 days); refresh by re-grabbing it from the browser and
updating the GitHub secret when it nears expiry.

What it captures (under data/official/):
  stats-latest.json + snapshots/stats-YYYY-MM-DD.json
        POST /private/stats — ALL riders, cumulative points broken down by
        source (stage finish, each climb category, breakaway km, combativity,
        the four jerseys, super-combativity). Daily snapshots let build_data.py
        derive per-stage points from consecutive-day deltas.
  journees.json
        GET /private/journee/{n} for each stage — name, type, status, deadline,
        and Matt's rank that stage (positionjoueur).
  myteam.json
        GET /private/feuillematch/{stage}/{idjg} for each completed stage —
        Matt's actual squad with per-rider points, captain flag, and the
        Tissot Bonus Question points.
  standings.json
        GET /private/classementgeneral/{league} — league standings.

Usage: python scripts/scrape_official.py
"""

import base64
import datetime
import json
import os
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "data" / "official"
SNAP_DIR = OUT_DIR / "snapshots"

API = "https://fantasybytissot.letour.fr/v1"
MAX_STAGES = 21


def load_token() -> str:
    """Token from env (CI) or a local token file (dev). Both `.tissot_token`
    and `tissot_token.txt` are accepted and gitignored."""
    tok = os.environ.get("TISSOT_TOKEN", "").strip()
    if tok:
        return tok
    for name in (".tissot_token", "tissot_token.txt"):
        f = REPO_ROOT / name
        if f.exists():
            return f.read_text(encoding="utf-8-sig").strip().strip('"').strip("'").strip()
    raise SystemExit("No token: set TISSOT_TOKEN or create .tissot_token")


def jwt_claims(tok: str) -> dict:
    """Decode the JWT payload (the 'sub' holds the player/league/team ids)."""
    payload = tok.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))


def make_session(tok: str) -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "User-Agent": "Mozilla/5.0",
            "X-Access-Key": "630@19.30",
            "Authorization": f"Token {tok}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
    )
    return s


def fetch_stats(s: requests.Session) -> dict:
    """POST /private/stats — every rider, cumulative points by source.

    pageSize is set well above the field size so the whole roster returns in
    one page; loadSelect=1 requests the accompanying legend/positions/clubs.
    """
    body = {
        "credentials": {
            "critereTriStats": "",
            "loadSelect": 1,
            "pageIndex": 0,
            "pageSize": 300,
        }
    }
    r = s.post(f"{API}/private/stats?lg=en", json=body, timeout=30)
    r.raise_for_status()
    return r.json()


def fetch_journees(s: requests.Session) -> list[dict]:
    """Stage metadata for each configured journee (stops at the first unset)."""
    journees = []
    for n in range(1, MAX_STAGES + 1):
        r = s.get(f"{API}/private/journee/{n}?lg=en", timeout=20)
        if r.status_code != 200:
            break
        j = r.json().get("journee", {})
        if not j.get("statut"):
            break  # future stage not configured yet
        journees.append(j)
    return journees


def fetch_myteam(s: requests.Session, idjg: str, completed_stages: list[int]) -> dict:
    """Matt's scorecard for each completed stage (per-rider points + captain)."""
    sheets = {}
    for n in completed_stages:
        r = s.get(f"{API}/private/feuillematch/{n}/{idjg}?lg=en", timeout=20)
        if r.status_code == 200:
            sheets[str(n)] = r.json()
    return sheets


def fetch_standings(s: requests.Session, league_id: str) -> dict:
    r = s.get(f"{API}/private/classementgeneral/{league_id}?lg=en", timeout=20)
    return r.json() if r.status_code == 200 else {}


def main() -> None:
    tok = load_token()
    claims = jwt_claims(tok)
    sub = claims.get("sub", {})
    idjg = sub.get("idjg")
    league_id = sub.get("idg") or sub.get("idl")
    exp = datetime.datetime.fromtimestamp(claims["exp"], datetime.UTC)
    days_left = (exp - datetime.datetime.now(datetime.UTC)).days
    print(f"Token valid until {exp:%Y-%m-%d} ({days_left} days left)")
    if days_left < 3:
        print("WARNING: token expires soon — refresh it from the browser.")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    SNAP_DIR.mkdir(parents=True, exist_ok=True)
    s = make_session(tok)
    today = datetime.date.today().isoformat()

    # 1) All-rider stats (the core dataset).
    stats = fetch_stats(s)
    stats["_scrapedDate"] = today
    (OUT_DIR / "stats-latest.json").write_text(
        json.dumps(stats, ensure_ascii=False), encoding="utf-8"
    )
    # Dated snapshot for per-stage deltas (idempotent per day).
    (SNAP_DIR / f"stats-{today}.json").write_text(
        json.dumps(stats, ensure_ascii=False), encoding="utf-8"
    )
    n_riders = len(stats.get("joueurs", []))
    print(f"stats: {n_riders} riders -> stats-latest.json + snapshot {today}")

    # 2) Stage metadata.
    journees = fetch_journees(s)
    (OUT_DIR / "journees.json").write_text(
        json.dumps(journees, ensure_ascii=False), encoding="utf-8"
    )
    completed = [int(j["numero"]) for j in journees if j.get("fantasy", {}).get("passed")]
    print(f"journees: {len(journees)} configured, completed stages {completed}")

    # 3) Matt's team scorecards for completed stages.
    if idjg:
        myteam = fetch_myteam(s, idjg, completed)
        (OUT_DIR / "myteam.json").write_text(
            json.dumps(myteam, ensure_ascii=False), encoding="utf-8"
        )
        print(f"myteam: scorecards for stages {sorted(int(k) for k in myteam)}")

    # 4) League standings.
    if league_id:
        standings = fetch_standings(s, league_id)
        (OUT_DIR / "standings.json").write_text(
            json.dumps(standings, ensure_ascii=False), encoding="utf-8"
        )
        n_players = len(standings.get("joueurs", []))
        print(f"standings: {n_players} players in league {league_id}")


if __name__ == "__main__":
    main()
