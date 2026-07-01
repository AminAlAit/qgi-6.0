"""Smoke tests for baseline.py (run-3.1 pilot run-2 baseline arm).

The heavy walk is MOCKED via a fake ``run_f_ml_1_poc``-shaped module injected as
``stability_select._WALK`` (same technique as test_stability_select). No xgboost /
sklearn / real panel or parquet is touched — this proves baseline writes the
frozen INTER-MODULE CONTRACT schema through the SHARED ``_final_fit`` path.

Requires only numpy + pandas + pytest.
"""
from __future__ import annotations

import json
import types

import numpy as np
import pandas as pd
import pytest

import baseline
import stability_select as ss


def _make_fake_walk(n_countries=12):
    """A minimal fake walk whose fit is deterministic and needs no ML stack."""
    fake = types.SimpleNamespace()
    fake.WINDOW_GRID = [3, 5]
    fake.normalize_country_id = lambda x: str(x)

    def build_samples(pos, negatives_per_positive=3, seed=0):
        rows = []
        for i in range(n_countries):
            c = f"Country{i:02d}"
            rows.append({"country": c, "year": 2000 + i, "label": 1})
            for j in range(negatives_per_positive):
                rows.append({"country": c, "year": 1990 + i + j, "label": 0})
        return pd.DataFrame(rows)

    fake.build_samples = build_samples
    fake.load_panel = lambda ind, panel_dir: None

    def build_X_y(samples, selected, window, panels):
        n = len(samples)
        X = np.zeros((n, 8 * len(selected)))
        y = samples["label"].to_numpy().astype(int)
        X[:, 0] = y + 0.01 * window
        c = samples["country"].to_numpy().astype(str)
        yr = samples["year"].to_numpy().astype(int)
        return X, y, c, yr

    fake.build_X_y = build_X_y

    def fit_predict_loco(X, y, countries, years, architecture, seed=0):
        probs = np.clip(0.5 + 0.3 * (2 * y - 1), 0.01, 0.99)
        return {
            "probs": np.asarray(probs, float),
            "labels": np.asarray(y, int),
            "countries": np.asarray(countries),
            "years": np.asarray(years),
            "per_country_auc": {},
            "global_auc": 0.75 + 0.001 * X.shape[1],  # window/set-size dependent for argmax
        }

    fake.fit_predict_loco = fit_predict_loco
    fake.bca_bootstrap_auc_ci = lambda probs, labels, B=2000, seed=0: {
        "auc": float(np.mean(probs)), "ci95_lo": 0.70, "ci95_hi": 0.82,
        "ci80_lo": 0.72, "ci80_hi": 0.80, "n_bootstrap": B, "method": "fake",
    }
    return fake


@pytest.fixture
def positives_csv(tmp_path):
    p = tmp_path / "positives.csv"
    p.write_text("country_id,event_year\nafghanistan,1975\nangola,1990\n", encoding="utf-8")
    return p


_CONTRACT_FIELDS = [
    "recipe_id", "arm", "selected_set", "loco_auc", "ci95_lo", "ci95_hi", "oof", "n_pos",
]


def test_baseline_writes_contract_schema(monkeypatch, tmp_path, positives_csv):
    monkeypatch.setattr(ss, "_WALK", _make_fake_walk())
    recipe = "banking_and_financial_crisis"  # 3-indicator run-2 set
    result = baseline.run_baseline(
        recipe_id=recipe, panel_dir=tmp_path, positives_csv=positives_csv,
        out_dir=tmp_path / "results", git_commit="abc123",
    )

    # Every frozen-contract field present with the right shape/values.
    for field in _CONTRACT_FIELDS:
        assert field in result, f"missing contract field {field}"
    assert result["arm"] == "run2"
    assert result["recipe_id"] == recipe
    assert result["selected_set"] == baseline.RUN2_SELECTED_SETS[recipe]
    assert result["n_pos"] == 12  # 12 positives in the fake canonical samples
    assert result["git_commit"] == "abc123"

    # OOF is a list of {country, year, prob, label} grouped by input countries.
    assert len(result["oof"]) > 0
    input_countries = {f"Country{i:02d}" for i in range(12)}
    for row in result["oof"]:
        assert set(row) == {"country", "year", "prob", "label"}
        assert row["country"] in input_countries

    # Uses the shared argmax-over-WINDOW_GRID final fit (smallest window on tie here).
    assert result["chosen_window"] == 3
    assert result["ci95_lo"] == 0.70 and result["ci95_hi"] == 0.82

    # File written at the frozen-contract path and re-loads with the contract schema.
    out_file = tmp_path / "results" / f"{recipe}.run2.json"
    assert out_file.exists()
    on_disk = json.loads(out_file.read_text(encoding="utf-8"))
    for field in _CONTRACT_FIELDS:
        assert field in on_disk, f"missing contract field on disk: {field}"
    assert on_disk["arm"] == "run2"


def test_all_five_recipes_have_a_recorded_set():
    expected = {
        "civil_war_and_insurgency", "executive_power_consolidation", "military_coup",
        "banking_and_financial_crisis", "territorial_disputes",
    }
    assert set(baseline.RUN2_SELECTED_SETS) == expected
    for r, s in baseline.RUN2_SELECTED_SETS.items():
        assert s and len(s) == len(set(s)), f"{r} set empty or has duplicates"


def test_baseline_rejects_unknown_recipe(monkeypatch, tmp_path, positives_csv):
    monkeypatch.setattr(ss, "_WALK", _make_fake_walk())
    with pytest.raises(KeyError):
        baseline.run_baseline(
            recipe_id="not_a_recipe", panel_dir=tmp_path, positives_csv=positives_csv,
            out_dir=tmp_path / "results",
        )
