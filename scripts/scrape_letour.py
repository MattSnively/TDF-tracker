"""Scrape official Tour de France classifications from letour.fr.

How the letour.fr rankings pages work (discovered July 2026):
  - /en/rankings/stage-N   -> stage-level classifications for stage N. The page
    embeds AJAX URLs (one per classification, each with a server-issued hash):
        /en/ajax/ranking/N/{code}/{hash}/subtab
    Stage codes: ite (stage result / times), ipe (points), ime (mountains),
    ije (youth), ete (team), ice (combativity), iqe (combined).
  - /en/rankings           -> general classifications AFTER THE LATEST COMPLETED
    stage, same AJAX mechanism with codes itg, ipg, img, ijg, etg, icg, iqg.

Because the general page only ever shows the latest standings, this scraper is
meant to run once per day right after each stage: the general snapshot it saves
under stage N is "the standings on the evening of stage N" — exactly what the
Tissot fantasy jersey bonuses are awarded on.

Output: data/raw/stage-NN/{code}.json, one file per classification, shaped as
  { "stage": N, "code": "ite", "scraped_at": iso8601, "headers": [...],
    "rows": [ { raw header->cell text map + parsed rank/name/team/bib } ] }

Usage:
  python scripts/scrape_letour.py --stage 1          # stage 1 + general snapshot
  python scripts/scrape_letour.py --stage 1 --no-general   # stage tables only
"""

import argparse
import datetime
import json
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = REPO_ROOT / "data" / "raw"
BASE = "https://www.letour.fr"

# A desktop browser user agent — letour.fr serves plain HTML but politely
# refuses obviously robotic requests.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
}

AJAX_URL_RE = re.compile(r"/en/ajax/ranking/(\d+)/([a-z]{3})/[a-f0-9]{32}/subtab")


def fetch(url: str) -> str:
    """GET a letour.fr URL and return the HTML body (raises on HTTP errors)."""
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.text


def extract_ajax_urls(page_html: str) -> dict[str, str]:
    """Map classification code -> full AJAX URL found in a rankings page."""
    urls = {}
    for match in re.finditer(r'data-tabs-ajax="([^"]+)"', page_html):
        path = match.group(1)
        m = AJAX_URL_RE.search(path)
        if m:
            urls[m.group(2)] = BASE + path
    return urls


def clean_cell(cell) -> str:
    """Flatten a table cell to trimmed visible text."""
    return re.sub(r"\s+", " ", cell.get_text(" ", strip=True)).strip()


def parse_ranking_table(html: str) -> tuple[list[str], list[dict]]:
    """Parse the single rankingTable in an AJAX subtab response.

    Returns (headers, rows) where each row maps header -> cell text plus
    normalized helper fields: rank (int|None), name, team, bib.
    """
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if table is None:
        return [], []

    header_cells = [clean_cell(th) for th in table.find_all("th")]
    rows = []
    for tr in table.find_all("tr"):
        cells = tr.find_all("td")
        if not cells:
            continue  # header row
        values = [clean_cell(td) for td in cells]
        row = dict(zip(header_cells, values))

        # Normalized helper fields, tolerant of per-classification layouts.
        rank_raw = row.get("Rank", values[0] if values else "")
        row["rank"] = int(rank_raw) if rank_raw.isdigit() else None
        row["name"] = row.get("Rider", row.get("Team", ""))
        row["team"] = row.get("Team", "")
        row["bib"] = row.get("Rider No.", "")
        rows.append(row)
    return header_cells, rows


def scrape_page(page_url: str, stage: int, out_dir: Path) -> list[str]:
    """Scrape one rankings page (stage or general) into out_dir; return codes saved."""
    page_html = fetch(page_url)
    ajax_urls = extract_ajax_urls(page_html)
    if not ajax_urls:
        print(f"  WARNING: no classification tabs found at {page_url}")
        return []

    saved = []
    for code, url in sorted(ajax_urls.items()):
        headers, rows = parse_ranking_table(fetch(url))
        if not rows:
            print(f"  {code}: empty table, skipping")
            continue
        payload = {
            "stage": stage,
            "code": code,
            "scraped_at": datetime.datetime.now(datetime.UTC).isoformat(),
            "source_url": url,
            "headers": headers,
            "rows": rows,
        }
        out_path = out_dir / f"{code}.json"
        out_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        saved.append(code)
        print(f"  {code}: {len(rows)} rows -> {out_path.relative_to(REPO_ROOT)}")
    return saved


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage", type=int, required=True, help="stage number 1-21")
    parser.add_argument(
        "--no-general",
        action="store_true",
        help="skip the general-classification snapshot (use when re-scraping an "
        "old stage after later stages have run — the general page would be stale)",
    )
    args = parser.parse_args()

    out_dir = RAW_DIR / f"stage-{args.stage:02d}"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Stage {args.stage} classifications:")
    stage_codes = scrape_page(f"{BASE}/en/rankings/stage-{args.stage}", args.stage, out_dir)

    if not args.no_general:
        # The base rankings page reflects standings after the latest completed
        # stage. Verify it matches the stage we're scraping before saving.
        print("General classification snapshot:")
        page_html = fetch(f"{BASE}/en/rankings")
        ajax_urls = extract_ajax_urls(page_html)
        general_stage = None
        for url in ajax_urls.values():
            m = AJAX_URL_RE.search(url)
            if m:
                general_stage = int(m.group(1))
                break
        if general_stage != args.stage:
            print(
                f"  WARNING: general page is showing stage {general_stage}, "
                f"not {args.stage} — skipping snapshot (rerun without a stage "
                f"mismatch, or use --no-general)."
            )
        else:
            scrape_page(f"{BASE}/en/rankings", args.stage, out_dir)

    if not stage_codes:
        sys.exit("No stage tables scraped — page structure may have changed.")


if __name__ == "__main__":
    main()
