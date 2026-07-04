"""Tests for the Tissot fantasy scoring engine (scripts/compute_points.py).

Covers the scoring tables against the official rules and runs the full
per-stage computation over a real scraped fixture (2025 Tour stage 1, captured
from letour.fr before the 2026 race began) with known outcomes.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import compute_points as cp

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "stage-2025-01"


# --- scoring table spot checks straight from the published rules ---

def test_stage_finish_table():
    assert cp.STAGE_FINISH[1] == 200
    assert cp.STAGE_FINISH[2] == 150
    assert cp.STAGE_FINISH[10] == 55
    assert cp.STAGE_FINISH[20] == 9
    assert cp.STAGE_FINISH[25] == 8      # 21st-25th band
    assert cp.STAGE_FINISH[50] == 4      # 41st-50th band
    assert cp.STAGE_FINISH[100] == 1     # last scoring position
    assert 101 not in cp.STAGE_FINISH


def test_sprint_table():
    assert cp.SPRINT[1] == 30
    assert cp.SPRINT[8] == 10
    assert cp.SPRINT[15] == 2
    assert 16 not in cp.SPRINT


def test_gc_bonus_table():
    assert cp.GC_BONUS[1] == 50
    assert cp.GC_BONUS[10] == 21
    assert cp.GC_BONUS[20] == 11
    assert cp.GC_BONUS[21] == 10         # 21st-25th band
    assert cp.GC_BONUS[45] == 6          # 41st-45th band
    assert cp.GC_BONUS[46] == 5          # 46th-50th band
    assert cp.GC_BONUS[100] == 1


def test_jersey_bonus_tables():
    assert cp.POINTS_BONUS[1] == 30 and cp.POINTS_BONUS[15] == 1
    assert cp.KOM_BONUS is cp.POINTS_BONUS
    assert cp.YOUTH_BONUS[1] == 20 and cp.YOUTH_BONUS[7] == 9 and cp.YOUTH_BONUS[15] == 1


# --- name normalization ---

def test_name_key_keeps_first_initial():
    assert cp.name_key("J. PHILIPSEN") == "J|PHILIPSEN"
    # Two-letter initials collapse to their first letter ("MR." vs letour "M.").
    assert cp.name_key("MR. VAN DER POEL") == "M|VAN DER POEL"
    assert cp.name_key("M. VAN DER POEL") == "M|VAN DER POEL"
    # Twins stay distinct.
    assert cp.name_key("T. JOHANNESSEN") != cp.name_key("A. JOHANNESSEN")
    # Hyphens fold so sheet spelling matches letour spelling.
    assert cp.name_key("V. Paret-Peintre") == cp.name_key("V. PARET PEINTRE")


# --- full stage computation over the 2025 stage-1 fixture ---
# Known outcomes: Philipsen won the stage, Vercher took combativity,
# Milan led the intermediate sprint order.

def test_fixture_stage_winner_points():
    riders = cp.compute_stage(FIXTURE, 1)
    philipsen = riders[cp.name_key("J. PHILIPSEN")]
    # 200 for winning; he was 4th at the intermediate sprint -> +18.
    assert philipsen["detail"]["finish"] == 200
    assert philipsen["detail"]["sprint"] == 18
    assert philipsen["stage"] == 218


def test_fixture_combativity():
    riders = cp.compute_stage(FIXTURE, 1)
    vercher = riders[cp.name_key("M. VERCHER")]
    assert vercher["detail"]["combativity"] == 30


def test_fixture_sprint_leader():
    riders = cp.compute_stage(FIXTURE, 1)
    milan = riders[cp.name_key("J. MILAN")]
    assert milan["detail"]["sprint"] == 30  # 1st at the intermediate sprint


def test_fixture_no_combativity_on_final_stage():
    # Same data treated as stage 21: stage combativity must NOT be awarded.
    riders = cp.compute_stage(FIXTURE, 21)
    vercher = riders.get(cp.name_key("M. VERCHER"), {"detail": {}})
    assert "combativity" not in vercher["detail"]


def test_fixture_kom_points_passthrough():
    # The single ime row in the fixture earned 1 official KOM point (cat 4).
    import json
    rows = json.loads((FIXTURE / "ime.json").read_text(encoding="utf-8"))["rows"]
    riders = cp.compute_stage(FIXTURE, 1)
    top = riders[cp.name_key(rows[0]["name"])]
    assert top["detail"]["col"] == cp.points_value(rows[0])
