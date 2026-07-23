"""Tests for the letour.fr classification URL extraction (scripts/scrape_letour.py).

Regression guard for the general-classification (yellow/green/polka/white jersey)
links: letour.fr embeds those in a JSON tab-config blob served from the /none
endpoint, while the visible stage tab exposes only its own e-suffix links as
data-tabs-ajax attributes. Reading only the attributes silently drops every
jersey holder for stages after the first.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import scrape_letour as sl

# A rankings page as letour.fr serves it: the visible stage tab as a
# data-tabs-ajax attribute (e-codes, /subtab), and the general-classification
# links only inside the entity-encoded, slash-escaped JSON config blob (g-codes,
# /none). Hashes are 32 hex chars, as the real regexes require.
H = "0" * 32
PAGE_HTML = (
    '<ul data-tabs-ajax="/en/ajax/ranking/18/ite/{h}/subtab"></ul>'
    "<script>var cfg = {{&quot;itg&quot;:&quot;\\/en\\/ajax\\/ranking\\/18\\/itg\\/{h}\\/none&quot;,"
    "&quot;ipg&quot;:&quot;\\/en\\/ajax\\/ranking\\/18\\/ipg\\/{h}\\/none&quot;,"
    "&quot;img&quot;:&quot;\\/en\\/ajax\\/ranking\\/18\\/img\\/{h}\\/none&quot;,"
    "&quot;ijg&quot;:&quot;\\/en\\/ajax\\/ranking\\/18\\/ijg\\/{h}\\/none&quot;}};</script>"
).format(h=H)


def test_general_urls_capture_all_jersey_codes():
    urls = sl.extract_general_urls(PAGE_HTML)
    assert set(urls) == {"itg", "ipg", "img", "ijg"}
    assert urls["itg"] == f"{sl.BASE}/en/ajax/ranking/18/itg/{H}/none"


def test_stage_attributes_alone_miss_the_jerseys():
    # The bug this guards against: the visible-tab attributes carry no g-codes.
    attr_codes = set(sl.extract_ajax_urls(PAGE_HTML))
    assert not (attr_codes & {"itg", "ipg", "img", "ijg"})
    assert attr_codes == {"ite"}
