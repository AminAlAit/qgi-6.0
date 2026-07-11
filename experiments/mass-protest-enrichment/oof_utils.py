"""Pure OOF-prediction utilities shared by the mass_protest 8-gate battery
(D5 per-country decomposition).

Direct structural port of `experiments/military-coup-enrichment/oof_utils.py` (same cycle
methodology) -- both functions are pure stdlib/numpy (no pandas, no ML stack) so they are
host-testable without Docker -- see test_oof_utils.py. `per_country_auc_from_oof` reuses
`score_pilot.auc` (the project's own Mann-Whitney-U AUC implementation, pure stdlib) rather
than reimplementing AUC a third time.
"""
from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
PILOT_DIR = QGI_ML_ROOT / "experiments" / "run-3.1-pilot"
if str(PILOT_DIR) not in sys.path:
    sys.path.insert(0, str(PILOT_DIR))

import score_pilot as sp  # noqa: E402  (pure stdlib -- zero ML-stack dependency, host-testable)


def per_country_auc_from_oof(oof: list[dict[str, Any]]) -> dict[str, float]:
    """Group pooled LOCO OOF predictions by `country` and compute each country's OWN AUC
    on its held-out rows (via `score_pilot.auc`). A country contributes an entry only if
    BOTH classes (label 0 and label 1) appear among its own held-out rows -- a single-class
    country's "AUC" is undefined, not silently 0.5 or 1.0.

    `oof` is the frozen-contract list of `{"country", "year", "prob", "label"}` dicts
    produced by `stability_select._final_fit` / `run_f_ml_1_poc.fit_predict_loco`.
    """
    by_country: dict[str, list[tuple[float, int]]] = defaultdict(list)
    for row in oof:
        by_country[str(row["country"])].append((float(row["prob"]), int(row["label"])))
    out: dict[str, float] = {}
    for country, rows in by_country.items():
        labels = [l for _p, l in rows]
        if len(set(labels)) < 2:
            continue
        probs = [p for p, _l in rows]
        auc = sp.auc(probs, labels)
        if auc == auc:  # skip NaN (defensive; len(set(labels))>=2 should already prevent this)
            out[country] = auc
    return out


def point_biserial_corr(binary: list[int], continuous: list[float]) -> float:
    """Pearson correlation between a binary 0/1 series and a continuous series (the
    point-biserial correlation IS the Pearson correlation when one variable is binary).
    Pure stdlib (no numpy/scipy dependency) so this stays host-testable.

    Returns NaN if either input is empty, the lengths mismatch, `binary` is single-valued
    (no variance -- e.g. every row 0 or every row 1), or `continuous` is single-valued.
    """
    n = len(binary)
    if n == 0 or n != len(continuous):
        return float("nan")
    if len(set(binary)) < 2 or len(set(continuous)) < 2:
        return float("nan")
    mean_b = sum(binary) / n
    mean_c = sum(continuous) / n
    cov = sum((b - mean_b) * (c - mean_c) for b, c in zip(binary, continuous)) / n
    var_b = sum((b - mean_b) ** 2 for b in binary) / n
    var_c = sum((c - mean_c) ** 2 for c in continuous) / n
    denom = (var_b * var_c) ** 0.5
    if denom < 1e-15:
        return float("nan")
    return cov / denom
