"""Tests for oof_utils.py -- pure, host-testable (no ML stack, no Docker)."""
from __future__ import annotations

import math
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import oof_utils as ou  # noqa: E402


# ============================================================================================
# per_country_auc_from_oof
# ============================================================================================
def test_per_country_auc_perfect_separation():
    oof = [
        {"country": "A", "year": 2000, "prob": 0.9, "label": 1},
        {"country": "A", "year": 2001, "prob": 0.1, "label": 0},
        {"country": "A", "year": 2002, "prob": 0.2, "label": 0},
    ]
    out = ou.per_country_auc_from_oof(oof)
    assert out == {"A": pytest.approx(1.0)}


def test_per_country_auc_skips_single_class_country():
    oof = [
        {"country": "A", "year": 2000, "prob": 0.9, "label": 1},
        {"country": "A", "year": 2001, "prob": 0.8, "label": 1},  # A is all-positive: no AUC
        {"country": "B", "year": 2000, "prob": 0.7, "label": 1},
        {"country": "B", "year": 2001, "prob": 0.3, "label": 0},
    ]
    out = ou.per_country_auc_from_oof(oof)
    assert "A" not in out
    assert out["B"] == pytest.approx(1.0)


def test_per_country_auc_chance_level():
    oof = [
        {"country": "C", "year": 2000, "prob": 0.5, "label": 1},
        {"country": "C", "year": 2001, "prob": 0.5, "label": 0},
    ]
    out = ou.per_country_auc_from_oof(oof)
    assert out["C"] == pytest.approx(0.5)


def test_per_country_auc_empty_input():
    assert ou.per_country_auc_from_oof([]) == {}


def test_per_country_auc_multiple_countries_independent():
    oof = [
        {"country": "A", "year": 2000, "prob": 0.9, "label": 1},
        {"country": "A", "year": 2001, "prob": 0.1, "label": 0},
        {"country": "B", "year": 2000, "prob": 0.1, "label": 1},  # B: inverted -> low AUC
        {"country": "B", "year": 2001, "prob": 0.9, "label": 0},
    ]
    out = ou.per_country_auc_from_oof(oof)
    assert out["A"] == pytest.approx(1.0)
    assert out["B"] == pytest.approx(0.0)


# ============================================================================================
# point_biserial_corr
# ============================================================================================
def test_point_biserial_perfect_positive():
    binary = [0, 0, 1, 1]
    continuous = [1.0, 2.0, 3.0, 4.0]
    r = ou.point_biserial_corr(binary, continuous)
    assert r > 0.8  # strong positive association (exact value: 2*sqrt(5)/5 ~ 0.8944)


def test_point_biserial_no_association():
    binary = [0, 1, 0, 1]
    continuous = [5.0, 5.0, 5.0, 5.0]  # constant -> no variance -> NaN
    r = ou.point_biserial_corr(binary, continuous)
    assert math.isnan(r)


def test_point_biserial_empty_returns_nan():
    assert math.isnan(ou.point_biserial_corr([], []))


def test_point_biserial_mismatched_lengths_returns_nan():
    assert math.isnan(ou.point_biserial_corr([0, 1], [1.0, 2.0, 3.0]))


def test_point_biserial_single_valued_binary_returns_nan():
    # binary is constant (all 1) -> no variance to correlate against
    assert math.isnan(ou.point_biserial_corr([1, 1, 1], [1.0, 2.0, 3.0]))


def test_point_biserial_known_value():
    # Hand-computed: binary=[0,0,1,1], continuous=[1,3,2,4] -> moderate positive
    binary = [0, 0, 1, 1]
    continuous = [1.0, 3.0, 2.0, 4.0]
    r = ou.point_biserial_corr(binary, continuous)
    assert 0.3 < r < 1.0  # exact value: sqrt(5)/5 ~ 0.4472
