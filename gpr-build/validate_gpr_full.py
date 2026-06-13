"""
FULL-METHOD GPR validation harness (build-plan T2.3, step "validate vs his 44 + global").

Extends the frozen PoC validator (`gpr-poc/validate_gpr_poc.py`) from the 5 overlap
countries to ALL `GPRC_<ISO3>` columns present in Caldara-Iacoviello's export, and
adds the PRODUCTION gate (per-country r >= 0.9 on the calibrated series, per Ji-Hoon's
protocol) on top of the PoC's diagnostic panel.

WHAT IS REUSED (not reinvented)
--------------------------------
The statistics helpers are IMPORTED from the frozen PoC module so there is ONE source
of truth and the smoke test provably reproduces the PoC number with the identical math:
    pearson_r, spearman_r, _rank_with_ties, zscore, rmse, diff,
    quantile_threshold, spike_recall
(all stdlib+xlrd, already tie-safe and de-trend-aware). See `from validate_gpr_poc import ...`.

WHAT IS NEW
-----------
  * Generic proxy intake: the harness takes a {ISO3: {YYYY-MM: value}} proxy series for
    ANY category combination (g1..g8 in any blend, or the PoC's (t02+t03)/total_docs).
    It does NOT compute the proxy itself -- the GPR-flag build (build_gpr_flags.py, on
    creds) produces the per-country-month series; this harness only scores it.
  * load_all_gprc(): reads EVERY GPRC_<ISO3> column (44 in the current export), not just
    the PoC's 12-country hand list.
  * Per-country panel for every covered country: n_months, levels-Pearson (diagnostic),
    delta-Spearman (HEADLINE), delta-Pearson, temporal-stability split, de-trended
    spike-recall, RMSE-z.
  * PRODUCTION gate (Ji-Hoon protocol): a per-country PASS at a configurable bar
    (default r >= 0.90). The bar METRIC is explicit and reported -- production targets
    per-country r > 0.9 on the CALIBRATED levels series, which is a DIFFERENT, stricter
    bar than the PoC's 0.35 mean delta-Spearman gate. We never silently switch metric
    (Ji-Hoon must-fix #1): the report states whether the 0.9 is levels-Pearson or
    delta-Spearman.
  * Affine calibration (fit a + b*proxy to GPRC on a train split, score on a holdout):
    GPRC is published as raw_share / mean(1985-2019) * 100, a positive affine map, so a
    fitted a+b*proxy is the honest way to put the proxy on his SCALE and report a
    LEVELS RMSE that means something. Correlations are affine-invariant so they do NOT
    need calibration; RMSE does.

HONESTY (carried verbatim from the PoC dictionary)
--------------------------------------------------
This is a re-implementation on a DIFFERENT corpus (GDELT machine-coded vs Iacoviello's
~10 newspapers) with a different normalization window and a different country-attribution
mechanism. Validate SHAPE and SPIKES; never claim the proxy IS the GPR.

Stdlib + xlrd only. No pandas/numpy/scipy.
"""

import csv
import json
import math
import os
import statistics
import sys

import xlrd
from xlrd.xldate import xldate_as_datetime

# ---------------------------------------------------------------------------
# Reuse the FROZEN PoC stats helpers (single source of truth).
# The PoC module is stdlib+xlrd and gates all I/O behind __main__, so importing
# it has no side effects. We add its directory to sys.path then import by name.
# ---------------------------------------------------------------------------
_HERE = os.path.dirname(os.path.abspath(__file__))
_POC_DIR = os.path.abspath(os.path.join(_HERE, "..", "gpr-poc"))
if _POC_DIR not in sys.path:
    sys.path.insert(0, _POC_DIR)

from validate_gpr_poc import (  # noqa: E402  (import after sys.path tweak, intentional)
    pearson_r,
    spearman_r,
    _rank_with_ties,
    zscore,
    rmse,
    diff,
    quantile_threshold,
    spike_recall,
)

# Default data locations (the answer key lives in the PoC tree; reuse it).
XLS_PATH = os.path.join(_POC_DIR, "data", "gpr_export.xls")
POC_CSV_PATH = os.path.join(_POC_DIR, "data", "topic_monthly.csv")

# Production gate default. NOTE: production targets per-country r > 0.9 on the CALIBRATED
# levels series (Caldara-Iacoviello fidelity bar), which is DISTINCT from the PoC's
# 0.35 mean delta-Spearman bar. The bar metric is parameterised so we never switch silently.
PRODUCTION_GATE_DEFAULT = 0.90
OOS_SPLIT_YEAR = 2020  # 2015-2019 vs 2020+ (temporal-stability descriptor, NOT a gate)


# ---------------------------------------------------------------------------
# Answer-key loading: ALL GPRC_<ISO3> columns (the full 44, not the PoC's 12)
# ---------------------------------------------------------------------------
def load_all_gprc(path=XLS_PATH):
    """Read EVERY GPRC_<ISO3> column from the export.

    Returns ({ISO3: {YYYY-MM: gprc_value}}, sorted_list_of_present_ISO3).
    Month decode mirrors the PoC's robust handling (xldate_as_datetime; string/int forms).
    Blank pre-1985 cells arrive as '' (str) and are skipped per-cell.
    """
    wb = xlrd.open_workbook(path)
    sh = wb.sheet_by_index(0)
    hdr = [str(h) for h in sh.row_values(0)]
    month_col = hdr.index("month")

    col_for_iso3 = {}
    for i, h in enumerate(hdr):
        if h.startswith("GPRC_"):
            col_for_iso3[h[len("GPRC_"):]] = i

    out = {iso3: {} for iso3 in col_for_iso3}
    for r in range(1, sh.nrows):
        ym = _decode_month(sh.cell_value(r, month_col), wb.datemode)
        if ym is None:
            continue
        for iso3, col in col_for_iso3.items():
            v = sh.cell_value(r, col)
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                out[iso3][ym] = float(v)
    return out, sorted(col_for_iso3)


def load_shareh_categories(path=XLS_PATH):
    """Read the global per-category SHAREH_CAT_1..8 series (Iacoviello's per-category
    article shares feeding the HISTORICAL GPR). Returns {cat_int: {YYYY-MM: value}}.

    These give a GLOBAL per-category validation surface for g1..g8 independent of any
    country (build-plan: validate each category against its SHAREH_CAT_k)."""
    wb = xlrd.open_workbook(path)
    sh = wb.sheet_by_index(0)
    hdr = [str(h) for h in sh.row_values(0)]
    month_col = hdr.index("month")

    col_for_cat = {}
    for i, h in enumerate(hdr):
        if h.startswith("SHAREH_CAT_"):
            try:
                col_for_cat[int(h[len("SHAREH_CAT_"):])] = i
            except ValueError:
                pass

    out = {c: {} for c in col_for_cat}
    for r in range(1, sh.nrows):
        ym = _decode_month(sh.cell_value(r, month_col), wb.datemode)
        if ym is None:
            continue
        for cat, col in col_for_cat.items():
            v = sh.cell_value(r, col)
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                out[cat][ym] = float(v)
    return out


def _decode_month(serial, datemode):
    """xls 'month' cell -> 'YYYY-MM' or None. Handles date-float, 'YYYY-MM[-..]', 'YYYYMM'."""
    if isinstance(serial, bool):
        return None
    if isinstance(serial, (int, float)) and serial:
        dt = xldate_as_datetime(serial, datemode)
        return "%04d-%02d" % (dt.year, dt.month)
    if isinstance(serial, str) and serial.strip():
        s = serial.strip()
        if "-" in s:
            return s[:7]
        if len(s) == 6 and s.isdigit():
            return s[:4] + "-" + s[4:]
    return None


# ---------------------------------------------------------------------------
# Alignment + affine calibration
# ---------------------------------------------------------------------------
def align(proxy_map, gprc_map):
    """Sorted overlap months and paired (proxy, gprc) value lists."""
    months = sorted(set(proxy_map) & set(gprc_map))
    px = [proxy_map[m] for m in months]
    gp = [gprc_map[m] for m in months]
    return months, px, gp


def fit_affine(proxy_vals, target_vals):
    """OLS fit target ~ a + b*proxy. Returns (a, b) or None if degenerate.

    GPRC is a positive affine transform of a raw article share, so a + b*proxy is the
    correct functional form to place the (differently-normalised, different-corpus)
    proxy onto his SCALE before reporting a levels RMSE."""
    n = len(proxy_vals)
    if n < 2 or len(target_vals) != n:
        return None
    mx = statistics.fmean(proxy_vals)
    my = statistics.fmean(target_vals)
    sxx = sxy = 0.0
    for x, y in zip(proxy_vals, target_vals):
        dx = x - mx
        sxx += dx * dx
        sxy += dx * (y - my)
    if sxx == 0.0:
        return None
    b = sxy / sxx
    a = my - b * mx
    return a, b


def apply_affine(coef, proxy_vals):
    a, b = coef
    return [a + b * x for x in proxy_vals]


def calibrated_holdout_rmse(months, px, gp, train_frac=0.6):
    """Fit a+b*proxy on the FIRST `train_frac` of the (time-ordered) overlap, report RMSE
    on the held-out tail in his GPRC units. Returns dict with coef, n_train, n_holdout,
    rmse_holdout, rmse_train. None if too few points.

    Holdout is the chronological TAIL (no shuffling) -- this is the honest forward test for
    a time series. RMSE here is in GPRC index units (NOT z-scored), so it is directly
    interpretable against his scale once calibrated."""
    n = len(months)
    if n < 6:
        return None
    n_train = max(2, int(round(n * train_frac)))
    if n_train >= n:  # need at least 1 holdout point
        n_train = n - 1
    n_hold = n - n_train
    if n_hold < 1 or n_train < 2:
        return None

    coef = fit_affine(px[:n_train], gp[:n_train])
    if coef is None:
        return None

    fit_train = apply_affine(coef, px[:n_train])
    fit_hold = apply_affine(coef, px[n_train:])
    return {
        "a": coef[0],
        "b": coef[1],
        "n_train": n_train,
        "n_holdout": n_hold,
        "train_window": months[0] + " to " + months[n_train - 1],
        "holdout_window": months[n_train] + " to " + months[-1],
        "rmse_train": rmse(fit_train, gp[:n_train]),
        "rmse_holdout": rmse(fit_hold, gp[n_train:]),
    }


# ---------------------------------------------------------------------------
# Per-country metrics (full panel + production gate)
# ---------------------------------------------------------------------------
def _window_metrics(months, px, gp, lo_year, hi_year):
    """Levels-Pearson and delta-Spearman over a sub-window. Returns (p_levels, sp_delta, n)."""
    idx = [i for i, m in enumerate(months) if lo_year <= int(m[:4]) <= hi_year]
    if len(idx) < 3:
        return None, None, len(idx)
    wpx = [px[i] for i in idx]
    wgp = [gp[i] for i in idx]
    return pearson_r(wpx, wgp), spearman_r(diff(wpx), diff(wgp)), len(idx)


def country_metrics(iso3, proxy_map, gprc_map,
                    production_gate=PRODUCTION_GATE_DEFAULT,
                    gate_metric="pearson_levels_calibrated",
                    min_months=3,
                    calib_train_frac=0.6):
    """Full per-country panel + production gate verdict.

    gate_metric selects WHICH r the production gate reads (so we never switch silently):
      "pearson_levels_calibrated" -> levels-Pearson (affine-invariant, == raw levels-Pearson)
                                      this is the production fidelity bar (default).
      "spearman_delta"            -> the PoC HEADLINE metric (de-trended rank co-movement).
      "pearson_delta"             -> delta-Pearson.
    The chosen metric NAME is recorded in the result so the report is unambiguous.
    """
    months, px, gp = align(proxy_map, gprc_map)
    n = len(months)
    if n < min_months:
        return None

    pearson_levels = pearson_r(px, gp)
    spearman_levels = spearman_r(px, gp)

    px_d, gp_d = diff(px), diff(gp)
    spearman_delta = spearman_r(px_d, gp_d)   # HEADLINE (de-trended)
    pearson_delta = pearson_r(px_d, gp_d)

    rmse_z = rmse(zscore(px), zscore(gp))

    p_early, sp_early, n_early = _window_metrics(months, px, gp, 0, OOS_SPLIT_YEAR - 1)
    p_late, sp_late, n_late = _window_metrics(months, px, gp, OOS_SPLIT_YEAR, 9999)

    sr, n_spikes = spike_recall(gp_d, px_d)

    calib = calibrated_holdout_rmse(months, px, gp, train_frac=calib_train_frac)

    # Production gate. NOTE the affine-invariance: levels-Pearson on the calibrated series
    # equals levels-Pearson on the raw proxy (a+b*x with b possibly <0 flips sign; we gate
    # on the raw signed r so an anti-correlated proxy correctly FAILS).
    gate_value = {
        "pearson_levels_calibrated": pearson_levels,
        "spearman_delta": spearman_delta,
        "pearson_delta": pearson_delta,
    }.get(gate_metric, pearson_levels)
    production_pass = (gate_value is not None) and (gate_value >= production_gate)

    return {
        "iso3": iso3,
        "n_months": n,
        "window": months[0] + " to " + months[-1],
        # core panel
        "pearson_r": pearson_levels,          # levels (diagnostic, trend-inflated)
        "spearman_r": spearman_delta,         # HEADLINE = delta-Spearman
        "pearson_delta": pearson_delta,
        "spike_recall": sr if sr is not None else 0.0,
        "rmse_z": rmse_z,
        # temporal-stability split (descriptor, NOT a gate)
        "pearson_r_2015_2019": p_early,
        "pearson_r_2020plus": p_late,
        "spearman_delta_2015_2019": sp_early,
        "spearman_delta_2020plus": sp_late,
        "n_2015_2019": n_early,
        "n_2020plus": n_late,
        # affine calibration -> levels RMSE in GPRC units on a chronological holdout
        "calibration": calib,
        # production gate
        "production_gate_metric": gate_metric,
        "production_gate_bar": production_gate,
        "production_gate_value": gate_value,
        "production_pass": production_pass,
        # extra diagnostics
        "_spearman_levels": spearman_levels,
        "_n_spikes": n_spikes,
    }


# ---------------------------------------------------------------------------
# Whole-panel driver: score a proxy across EVERY covered GPRC country
# ---------------------------------------------------------------------------
def validate_panel(proxy_by_iso3, gprc_by_iso3=None,
                   production_gate=PRODUCTION_GATE_DEFAULT,
                   gate_metric="pearson_levels_calibrated",
                   poc_bar_delta_spearman=0.35,
                   min_months=3,
                   calib_train_frac=0.6,
                   xls_path=XLS_PATH):
    """Score a proxy series ({ISO3: {YYYY-MM: value}}) against ALL GPRC countries it covers.

    Returns a results dict with per_country panels + aggregates + BOTH gates:
      - production gate: count of per-country PASS at `production_gate` on `gate_metric`.
      - PoC-equivalent reference gate: mean delta-Spearman vs `poc_bar_delta_spearman`
        (reported alongside so the harness reproduces / contextualises the PoC verdict).
    """
    if gprc_by_iso3 is None:
        gprc_by_iso3, _present = load_all_gprc(xls_path)

    covered = sorted(
        iso3 for iso3 in proxy_by_iso3
        if iso3 in gprc_by_iso3 and (set(proxy_by_iso3[iso3]) & set(gprc_by_iso3[iso3]))
    )

    per_country = []
    for iso3 in covered:
        m = country_metrics(
            iso3, proxy_by_iso3[iso3], gprc_by_iso3[iso3],
            production_gate=production_gate, gate_metric=gate_metric,
            min_months=min_months, calib_train_frac=calib_train_frac,
        )
        if m is not None:
            per_country.append(m)

    scored = sorted(c["iso3"] for c in per_country)

    headline_spear = [c["spearman_r"] for c in per_country if c["spearman_r"] is not None]
    levels_pear = [c["pearson_r"] for c in per_country if c["pearson_r"] is not None]
    delta_pear = [c["pearson_delta"] for c in per_country if c["pearson_delta"] is not None]
    recalls = [c["spike_recall"] for c in per_country]

    mean_spearman_r = statistics.fmean(headline_spear) if headline_spear else None
    mean_pearson_r = statistics.fmean(levels_pear) if levels_pear else None
    mean_pearson_delta = statistics.fmean(delta_pear) if delta_pear else None
    mean_spike_recall = statistics.fmean(recalls) if recalls else None

    n_prod_pass = sum(1 for c in per_country if c["production_pass"])
    prod_pass_iso3 = sorted(c["iso3"] for c in per_country if c["production_pass"])

    n_ge_025 = sum(1 for c in per_country if (c["spearman_r"] or 0) >= 0.25)
    any_negative = any((c["spearman_r"] or 0) < 0 for c in per_country)
    poc_equiv_pass = (
        mean_spearman_r is not None and mean_spearman_r >= poc_bar_delta_spearman
        and n_ge_025 >= 3 and not any_negative
    )

    return {
        "scored_countries": scored,
        "n_scored": len(scored),
        "n_gprc_columns_in_key": len(gprc_by_iso3),
        "window": (per_country[0]["window"] if per_country else None),
        "per_country": per_country,
        # aggregates
        "mean_pearson_r_levels_diagnostic": mean_pearson_r,
        "mean_spearman_r_headline": mean_spearman_r,
        "mean_pearson_delta": mean_pearson_delta,
        "mean_spike_recall": mean_spike_recall,
        "spike_recall_chance_baseline": 0.25,
        # PRODUCTION gate (Ji-Hoon protocol)
        "production_gate": {
            "metric": gate_metric,
            "bar": production_gate,
            "bar_note": (
                "PRODUCTION targets per-country r >= %.2f on the CALIBRATED levels series "
                "(Caldara-Iacoviello fidelity bar). This is a DIFFERENT, stricter bar than "
                "the PoC's 0.35 mean delta-Spearman gate. Metric reported as '%s' so the "
                "levels-vs-delta choice is never switched silently (Ji-Hoon must-fix #1)."
                % (production_gate, gate_metric)
            ),
            "n_pass": n_prod_pass,
            "n_scored": len(scored),
            "pass_iso3": prod_pass_iso3,
            "PASS_ALL": (len(scored) > 0 and n_prod_pass == len(scored)),
        },
        # PoC-equivalent reference gate (delta-Spearman; reproduces the PoC verdict surface)
        "poc_equivalent_gate": {
            "metric": "mean delta-Spearman",
            "bar": "mean >= %.2f AND >=3 countries >=0.25 AND none negative" % poc_bar_delta_spearman,
            "mean_delta_spearman": mean_spearman_r,
            "n_countries_ge_0.25": n_ge_025,
            "any_negative": any_negative,
            "PASS": poc_equiv_pass,
        },
        "honesty_note": (
            "Re-implementation on a DIFFERENT corpus (GDELT machine-coded vs Iacoviello's "
            "~10 newspapers), different normalization window, different country-attribution. "
            "Levels are NOT directly comparable; correlations test SHAPE, calibration RMSE "
            "uses an affine fit to put the proxy on his scale. Never claim the proxy IS GPR."
        ),
    }


# ---------------------------------------------------------------------------
# Proxy builders (helpers; the harness scores ANY {ISO3:{ym:val}} series)
# ---------------------------------------------------------------------------
# FIPS country_code (as used in the GDELT topic_monthly.csv) -> ISO3.
# Sourced from the PoC's verified join; this is the SAME 12-country list the PoC used.
FIPS_TO_ISO3 = {
    "AR": "ARG", "BG": "BGD", "EG": "EGY", "IR": "IRN", "LE": "LBN",
    "BM": "MMR", "NI": "NGA", "PK": "PAK", "SU": "SDN", "TH": "THA",
    "TS": "TUN", "VE": "VEN",
}


def build_topic_share_proxy(csv_path=POC_CSV_PATH, topics=("t02", "t03"),
                            fips_to_iso3=None):
    """Rebuild a (sum(topics))/total_docs proxy from the GDELT topic_monthly.csv, keyed by
    ISO3. This is the PoC's PRIMARY proxy when topics=('t02','t03').

    Returns ({ISO3: {YYYY-MM: share}}, share_out_of_range_flags). total_docs==0 months are
    skipped; shares outside [0,1] are flagged (logged, never clamped) per the PoC guard."""
    if fips_to_iso3 is None:
        fips_to_iso3 = FIPS_TO_ISO3
    by_iso3 = {}
    flags = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        rd = csv.DictReader(f)
        for row in rd:
            code = row["country_code"]
            iso3 = fips_to_iso3.get(code)
            if iso3 is None:
                continue
            ym = row["month"]
            try:
                total = float(row["total_docs"])
                num = sum(float(row[t]) for t in topics)
            except (ValueError, KeyError):
                continue
            if total <= 0:
                continue
            share = num / total
            if not (0.0 <= share <= 1.0):
                flags.append({"iso3": iso3, "month": ym, "value": share})
            by_iso3.setdefault(iso3, {})[ym] = share
    return by_iso3, flags


# ---------------------------------------------------------------------------
# CLI / smoke entrypoint
# ---------------------------------------------------------------------------
def main():
    import argparse
    ap = argparse.ArgumentParser(
        description="Full-method GPR validation harness (scores a proxy vs ALL 44 GPRC countries)."
    )
    ap.add_argument("--xls", default=XLS_PATH, help="Caldara-Iacoviello export (answer key).")
    ap.add_argument("--csv", default=POC_CSV_PATH,
                    help="GDELT topic_monthly.csv to rebuild the PoC (t02+t03)/total proxy from "
                         "(when no external proxy JSON is supplied).")
    ap.add_argument("--proxy-json", default=None,
                    help="Optional {ISO3:{YYYY-MM:value}} proxy series JSON (e.g. a g1..g8 blend "
                         "from the GPR-flag build). When omitted, the PoC topic-share proxy is used.")
    ap.add_argument("--topics", default="t02,t03",
                    help="Comma topics to sum for the rebuilt topic-share proxy (default t02,t03).")
    ap.add_argument("--gate", type=float, default=PRODUCTION_GATE_DEFAULT,
                    help="Production gate bar (default 0.90).")
    ap.add_argument("--gate-metric", default="pearson_levels_calibrated",
                    choices=["pearson_levels_calibrated", "spearman_delta", "pearson_delta"],
                    help="Which r the production gate reads (reported, never switched silently).")
    ap.add_argument("--out", default=os.path.join(_HERE, "gpr-full-results.json"))
    args = ap.parse_args()

    if args.proxy_json:
        with open(args.proxy_json, encoding="utf-8") as f:
            proxy = json.load(f)
        share_flags = []
    else:
        proxy, share_flags = build_topic_share_proxy(
            args.csv, topics=tuple(t.strip() for t in args.topics.split(",") if t.strip())
        )

    results = validate_panel(
        proxy, production_gate=args.gate, gate_metric=args.gate_metric, xls_path=args.xls
    )
    results["share_out_of_range_flags"] = share_flags
    results["proxy_source"] = (args.proxy_json or
                               "rebuilt (%s)/total_docs from %s" % (args.topics, os.path.basename(args.csv)))

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(json.dumps(results, indent=2))
    return results


if __name__ == "__main__":
    main()
