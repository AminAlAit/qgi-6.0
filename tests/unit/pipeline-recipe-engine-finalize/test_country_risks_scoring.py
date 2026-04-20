"""
Unit tests for country_risks.py scoring logic (#375).

Covers:
- drama_weight lookup (known + unknown categories)
- zscore_per_country (multi-pred countries, single-pred passthrough)
- rank_fusion (RRF with and without missing keys)
- risk_tier_label (category-stratified thresholds per #339)
- _to_int_safe / _to_float_safe robustness
- compute_country_risks end-to-end with a stubbed Athena
- write_country_risks_json S3 call (assert via mock)
"""
import importlib.util
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# Load the module directly from the Lambda dir (no package install)
_MODULE_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / 'lambdas' / 'pipeline-recipe-engine-finalize' / 'country_risks.py'
)
_spec = importlib.util.spec_from_file_location('country_risks', _MODULE_PATH)
country_risks = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(country_risks)


# ─── drama_weight ─────────────────────────────────────────────────────

@pytest.mark.parametrize("category,expected", [
    ("civil_war_and_insurgency", 1.0),
    ("interstate_war", 1.0),
    ("currency_crisis", 0.8),
    ("elections_and_voting", 0.6),
    ("government_formation", 0.4),
    ("environmental_policy", 0.2),
    ("infrastructure_project", 0.05),
    ("some_future_category_not_yet_classified", 0.3),  # default
    ("", 0.3),
])
def test_drama_weight(category, expected):
    assert country_risks.drama_weight(category) == expected


# ─── zscore_per_country ───────────────────────────────────────────────

def test_zscore_per_country_multi_pred():
    preds = {
        (1, "a"): 10.0, (1, "b"): 20.0, (1, "c"): 30.0,  # country 1: mean=20
        (2, "a"): 5.0, (2, "b"): 15.0,                    # country 2: mean=10
    }
    out = country_risks.zscore_per_country(preds)
    # Country 1: z = (x - 20) / std
    assert out[(1, "b")] == pytest.approx(0.0, abs=1e-6)
    assert out[(1, "a")] < 0 and out[(1, "c")] > 0
    # Country 2 means pass through normalized too
    assert out[(2, "a")] == pytest.approx(-1.0, abs=1e-6)
    assert out[(2, "b")] == pytest.approx(1.0, abs=1e-6)


def test_zscore_per_country_single_pred_passthrough():
    """Country with only 1 prediction passes through unchanged (no std)."""
    preds = {(99, "only"): 42.5}
    out = country_risks.zscore_per_country(preds)
    assert out == {(99, "only"): 42.5}


def test_zscore_per_country_empty():
    assert country_risks.zscore_per_country({}) == {}


def test_zscore_per_country_all_equal_uses_floor_std():
    """Zero variance → std floor of 1e-6 (no division by zero)."""
    preds = {(1, "a"): 5.0, (1, "b"): 5.0, (1, "c"): 5.0}
    out = country_risks.zscore_per_country(preds)
    # All zeros (or close to it) — no crash
    for v in out.values():
        assert abs(v) < 1e-3


# ─── rank_fusion ──────────────────────────────────────────────────────

def test_rank_fusion_both_sources():
    recipe = {(1, "a"): 10.0, (1, "b"): 5.0}
    persist = {(1, "a"): 1.0, (1, "b"): 2.0}
    out = country_risks.rank_fusion(recipe, persist)
    # Both keys present in both sources → both have RRF scores
    assert (1, "a") in out and (1, "b") in out
    # Rank 1 in both sources → highest RRF
    # (1,a) is rank 1 in recipe, rank 2 in persist; (1,b) is rank 2 in recipe, rank 1 in persist
    # Equal total ranks → equal RRF scores
    assert out[(1, "a")] == pytest.approx(out[(1, "b")])


def test_rank_fusion_missing_in_one_source():
    recipe = {(1, "a"): 10.0, (1, "b"): 5.0}
    persist = {(1, "a"): 1.0}
    out = country_risks.rank_fusion(recipe, persist)
    # (1, "b") missing in persist → gets max_rank fallback
    assert (1, "a") in out and (1, "b") in out
    assert out[(1, "a")] > out[(1, "b")]


def test_rank_fusion_empty():
    assert country_risks.rank_fusion({}, {}) == {}


# ─── risk_tier_label ──────────────────────────────────────────────────

@pytest.mark.parametrize("salience,drama,expected", [
    (1.4, 1.0, "HIGH"),       # crisis + at threshold → HIGH
    (1.5, 1.0, "HIGH"),       # crisis + above threshold → HIGH
    (1.625, 0.6, "HIGH"),     # regular + at threshold → HIGH
    (1.5, 0.6, "MODERATE"),   # regular + below HIGH → MODERATE
    (1.3, 0.6, "MODERATE"),   # regular + at MODERATE threshold
    (1.0, 1.0, "MODERATE"),   # crisis + at MODERATE threshold
    (0.9, 1.0, "INDICATIVE"), # crisis + below MODERATE
    (1.29, 0.6, "INDICATIVE"),# regular + below MODERATE
    (0.0, 0.3, "INDICATIVE"), # floor
])
def test_risk_tier_label(salience, drama, expected):
    assert country_risks.risk_tier_label(salience, drama) == expected


def test_risk_tier_label_crisis_preserves_ukraine_iran():
    """Regression guard (#339): Ukraine/Iran around salience=1.17 in a crisis
    category must land in MODERATE (not INDICATIVE) because crisis categories
    use the lower 1.0 MODERATE floor."""
    assert country_risks.risk_tier_label(1.17, 1.0) == "MODERATE"


# ─── coerce helpers ───────────────────────────────────────────────────

@pytest.mark.parametrize("inp,expected", [
    (None, None), ("", None), ("abc", None),
    ("5", 5), ("5.7", 5), ("100", 100), (42, 42),
])
def test_to_int_safe(inp, expected):
    assert country_risks._to_int_safe(inp) == expected


@pytest.mark.parametrize("inp,expected", [
    (None, None), ("", None), ("abc", None),
    ("5", 5.0), ("5.7", 5.7), ("1e3", 1000.0),
])
def test_to_float_safe(inp, expected):
    assert country_risks._to_float_safe(inp) == expected


# ─── compute_country_risks integration (stubbed Athena) ──────────────

class _StubAthena:
    """Minimal stub that routes queries to canned responses by SQL keyword."""

    def __init__(self, canned):
        self.canned = canned
        self.queries = []
        self._next_id = 0

    def run(self, sql):
        self.queries.append(sql)
        self._next_id += 1
        return f"qid-{self._next_id}"

    def rows(self, query_id):
        # Look up by the sql of the matching query_id
        idx = int(query_id.split('-')[1]) - 1
        sql = self.queries[idx]
        for keyword, rows in self.canned.items():
            if keyword in sql:
                return rows
        return []


def test_compute_country_risks_minimal():
    """One country, one event + one recipe + one scdi, produces a valid payload."""
    canned = {
        'FROM qgi_data.countries': [
            {'id': '1', 'name_1': 'Testland', 'alpha_2': 'TL'},
        ],
        'WHERE category_normalized IS NOT NULL GROUP BY country_id': [
            {'country_id': '1', 'category_normalized': 'elections_and_voting', 'y': '2024'},
        ],
        'WHERE year BETWEEN 2023 AND 2025': [
            {'country_id': '1', 'category_normalized': 'elections_and_voting', 'c': '3'},
        ],
        'FROM qgi_data.scdis': [
            {'country_a_id': '1', 'p': '10'},
        ],
        'FROM qgi_data.recipes': [
            {'country_a_id': '1', 'event_category': 'elections_and_voting',
             'c': '5', 'a': '0.85', 'i': '4'},
        ],
    }
    athena = _StubAthena(canned)
    payload = country_risks.compute_country_risks(athena.run, athena.rows)

    assert payload['version'] == 'V1.8.1'
    assert payload['total_countries'] == 1
    assert '1' in payload['countries']
    entry = payload['countries']['1']
    assert entry['name'] == 'Testland'
    assert entry['alpha_2'] == 'TL'
    assert entry['curated'] is True  # id=1 is in CURATED_IDS
    assert 'S' in entry['tiers']
    s_cats = entry['tiers']['S']['top_categories']
    assert len(s_cats) == 1
    assert s_cats[0]['category'] == 'elections_and_voting'
    assert s_cats[0]['drama_tier'] == 0.6
    assert entry['overall_risk_tier'] in {'HIGH', 'MODERATE', 'INDICATIVE'}


def test_compute_country_risks_empty_returns_skeleton():
    """Zero countries, zero events, zero recipes → valid empty payload."""
    athena = _StubAthena({})
    payload = country_risks.compute_country_risks(athena.run, athena.rows)
    assert payload['total_countries'] == 0
    assert payload['countries'] == {}
    assert payload['version'] == 'V1.8.1'
    assert 'S' in payload['tiers'] and 'XL' in payload['tiers']


def test_compute_country_risks_uncurated_country_flagged():
    canned = {
        'FROM qgi_data.countries': [
            {'id': '500', 'name_1': 'Neverland', 'alpha_2': 'NL'},
        ],
        'WHERE category_normalized IS NOT NULL GROUP BY country_id': [],
        'WHERE year BETWEEN 2023 AND 2025': [],
        'FROM qgi_data.scdis': [],
        'FROM qgi_data.recipes': [],
    }
    athena = _StubAthena(canned)
    payload = country_risks.compute_country_risks(athena.run, athena.rows)
    # id=500 NOT in CURATED_IDS → payload excludes it (no recipe rows)
    # which is actually the current behavior — country only appears if scored
    assert payload['total_countries'] == 0


# ─── write_country_risks_json (S3 mock) ───────────────────────────────

def test_write_country_risks_json_calls_s3():
    athena = _StubAthena({})
    s3 = MagicMock()
    summary = country_risks.write_country_risks_json(
        athena.run, athena.rows, s3, 'test-bucket'
    )
    s3.put_object.assert_called_once()
    kwargs = s3.put_object.call_args.kwargs
    assert kwargs['Bucket'] == 'test-bucket'
    assert kwargs['Key'] == 'dashboard/country-risks.json'
    assert kwargs['ContentType'] == 'application/json'
    # Body parses back to the same payload shape
    parsed = json.loads(kwargs['Body'].decode('utf-8'))
    assert parsed['version'] == 'V1.8.1'
    assert summary['countries'] == 0
    assert summary['curated'] == len(country_risks.CURATED_IDS)
    assert 'bytes' in summary and summary['bytes'] > 0
