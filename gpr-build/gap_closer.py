"""
GPR Learned Gap-Closer (F-GPR-1) -- implements Ji-Hoon Park's RATIFIED protocol.

QUESTION
--------
The naive blended GPR proxy (`gpr_share` = gpr_matched/total_docs) tracks the published
Caldara-Iacoviello country GPR at mean delta-Spearman ~0.4604 across 44 countries, but
0/44 reach the r>0.9 production gate (corpus ceiling: GDELT machine-coded vs Iacoviello's
~10 broadsheets). CAN A LEARNED RE-WEIGHTING of the same GDELT-derived categories BEAT
that 0.46, OUT OF SAMPLE?

This is a FALSIFICATION experiment with a hard pre-registered bar (Ji-Hoon's prior: it
fails bar 1; a clean null is the publishable finding).

MODEL (protocol (a)/(b))
------------------------
One POOLED ridge (L2) linear regression across all 44 countries, solved by stdlib normal
equations `(X'X + lambda*I)^-1 X'y`. NO poly / NO piecewise. NO per-country model.
  Features (11): 8 category shares g1/total..g8/total, + threats_share, acts_share, avg_tone.
  NOT a feature: gpr_share (that IS the naive proxy -> baseline only), raw counts, total_docs.
  Per-country TARGET de-meaning (within / fixed-effects), TRAIN-ONLY mean. Features z-scored
  on TRAIN-ONLY mean/sd. So ridge explains variation around each country's own baseline --
  exactly what delta-Spearman rewards.

SPLIT (protocol (c))
--------------------
Chronological 60/40 on the global month index (panel is rectangular): first 81 months train
(2015-02 .. 2021-10), last 55 months test (2021-11 .. 2026-05). TEST IS SEALED -- no fit,
no standardization stat, no de-mean constant, no lambda selection reads a test month.

LAMBDA (protocol (d))
---------------------
Nested chronological split INSIDE train (inner 80% fit = months 1..65, inner 20% validate =
66..81). Sweep pre-registered grid {0.01,0.1,1,10,100} on standardized features, pick best
inner-validation mean delta-Spearman, refit on all 81 train months at that lambda. Sane-default
fallback = 1.0 if best sits at a grid edge OR inner spread is within noise.

THE BAR (protocol (e)) -- pre-registered, frozen, ALL must hold to SHIP over naive 0.46:
  1. mean OOS delta-Spearman >= 0.51 (naive 0.4604 + >= 0.05).
  2. gap-closer OOS delta-Spearman >= naive's OOS delta-Spearman in >= 30 / 44 countries.
  3. (in-sample train delta-Spearman) - (OOS test delta-Spearman) <= 0.10 (overfit guard).
  4. zero countries with NEGATIVE OOS delta-Spearman.
  r>0.9 is the PRODUCTION fidelity bar, NOT this experiment's bar (unreachable by re-weighting
  the same GDELT signal -- corpus ceiling). It is reported diagnostically only.

GUARDS G1-G8 are honored and the freeze order is recorded in the output JSON.

Stdlib + xlrd only. No numpy/sklearn/pandas. No pip. No cloud. Pure local, free.
"""

import csv
import json
import os
import statistics
import sys

# ---------------------------------------------------------------------------
# G5 -- single source of truth for metrics. Import the FROZEN helpers; do NOT
# reimplement the math. The new code is ridge + plumbing only.
# ---------------------------------------------------------------------------
_HERE = os.path.dirname(os.path.abspath(__file__))
_POC_DIR = os.path.abspath(os.path.join(_HERE, "..", "gpr-poc"))
if _POC_DIR not in sys.path:
    sys.path.insert(0, _POC_DIR)

from validate_gpr_poc import (  # noqa: E402  (import after sys.path tweak, intentional)
    pearson_r,
    spearman_r,
    diff,
    zscore,   # noqa: F401  (imported for single-source parity / availability)
    rmse,     # noqa: F401
)

# Reuse the full-method loader for the answer key (ALL 44 GPRC columns) and fit_affine
# (defined there, not in the PoC module) -- still single-source, no reimplementation.
sys.path.insert(0, _HERE)
from validate_gpr_full import load_all_gprc, fit_affine  # noqa: E402,F401

CSV_PATH = r"C:/tmp/gpr_monthly_v2.csv"
XLS_PATH = os.path.join(_POC_DIR, "data", "gpr_export.xls")
RESULTS_JSON_PATH = os.path.join(_HERE, "gpr-build", "gap-closer-results.json")  # overridden below
RESULTS_JSON_PATH = os.path.join(_HERE, "gap-closer-results.json")
FIPS_MAP_JSON = os.path.join(_HERE, "gpr-full-results.json")

# Feature columns IN ORDER (11). Category shares are computed g_k/total_docs at load time;
# threats_share / acts_share / avg_tone are taken from the CSV directly.
CATEGORY_COLS = [
    "g1_war_threats", "g2_peace_threats", "g3_military_buildups", "g4_nuclear_threats",
    "g5_terror_threats", "g6_beginning_of_war", "g7_escalation_of_war", "g8_terror_acts",
]
FEATURE_NAMES = (
    ["g1_share", "g2_share", "g3_share", "g4_share",
     "g5_share", "g6_share", "g7_share", "g8_share"]
    + ["threats_share", "acts_share", "avg_tone"]
)
N_FEATURES = len(FEATURE_NAMES)  # 11

TRAIN_FRAC = 0.60                 # protocol (c): first 60% of months = train
INNER_TRAIN_FRAC = 0.80           # protocol (d): inner 80% fit / 20% validate of the train block
LAMBDA_GRID = [0.01, 0.1, 1.0, 10.0, 100.0]
LAMBDA_SANE_DEFAULT = 1.0
INNER_NOISE_EPS = 1e-3            # "within noise across the grid" threshold for fallback

# Pre-registered ship bars (protocol (e)).
BAR1_MEAN_DELTA_SPEARMAN = 0.51
BAR2_MIN_COUNTRIES_BEAT = 30
BAR3_MAX_OVERFIT_GAP = 0.10
NAIVE_REFERENCE = 0.4604
PRODUCTION_FIDELITY_BAR = 0.90    # reported diagnostically; NOT this experiment's bar


# ===========================================================================
# Load FIPS->ISO3 map (G: 44 mapped entries, verified)
# ===========================================================================
def load_fips_to_iso3(path=FIPS_MAP_JSON):
    with open(path, encoding="utf-8") as f:
        m = json.load(f)["fips_to_iso3_map"]
    return m


# ===========================================================================
# Load features -> {ISO3: {YYYY-MM: [11 raw feature values]}}
# G4 -- runtime hygiene assertions: total_docs>0 before any share, shares in [0,1]
# flagged (not clamped), avg_tone parses to float (skip+log otherwise).
# ===========================================================================
def load_features(csv_path, fips_to_iso3):
    by_iso3 = {}
    share_flags = []     # shares outside [0,1] -> flagged, not clamped (G4)
    skipped = []         # months skipped for total_docs<=0 or unparseable (G4)
    with open(csv_path, newline="", encoding="utf-8") as f:
        rd = csv.DictReader(f)
        for row in rd:
            iso3 = fips_to_iso3.get(row["country_code"])
            if iso3 is None:
                continue
            ym = row["month"]
            # G4: total_docs > 0 before forming any share.
            try:
                total = float(row["total_docs"])
            except (ValueError, KeyError):
                skipped.append({"iso3": iso3, "month": ym, "reason": "total_docs unparseable"})
                continue
            if total <= 0:
                skipped.append({"iso3": iso3, "month": ym, "reason": "total_docs<=0"})
                continue
            # G4: avg_tone parses to float.
            try:
                tone = float(row["avg_tone"])
            except (ValueError, KeyError):
                skipped.append({"iso3": iso3, "month": ym, "reason": "avg_tone unparseable"})
                continue
            try:
                cat_counts = [float(row[c]) for c in CATEGORY_COLS]
                threats_share = float(row["threats_share"])
                acts_share = float(row["acts_share"])
            except (ValueError, KeyError):
                skipped.append({"iso3": iso3, "month": ym, "reason": "category/share unparseable"})
                continue

            cat_shares = [c / total for c in cat_counts]
            feats = cat_shares + [threats_share, acts_share, tone]

            # G4: each SHARE in [0,1] -> flag, do NOT clamp. (avg_tone is signed; not a share.)
            for name, val in zip(FEATURE_NAMES[:10], feats[:10]):  # 8 cat shares + 2 shares
                if not (0.0 <= val <= 1.0):
                    share_flags.append({"iso3": iso3, "month": ym, "feature": name, "value": val})

            by_iso3.setdefault(iso3, {})[ym] = feats
    return by_iso3, share_flags, skipped


# ===========================================================================
# Build the rectangular pooled panel aligned to GPRC.
# Returns, per ISO3: sorted overlap months, X rows (raw features), y (GPRC), and the
# global train/test month boundary (same for every country -- panel is rectangular).
# ===========================================================================
def build_panel(features_by_iso3, gprc_by_iso3):
    panel = {}
    common_months = None
    for iso3, feat_map in features_by_iso3.items():
        if iso3 not in gprc_by_iso3:
            continue
        months = sorted(set(feat_map) & set(gprc_by_iso3[iso3]))
        if not months:
            continue
        panel[iso3] = {
            "months": months,
            "X": [feat_map[m] for m in months],
            "y": [gprc_by_iso3[iso3][m] for m in months],
        }
        ms = set(months)
        common_months = ms if common_months is None else (common_months & ms)
    return panel, sorted(common_months) if common_months else []


# ===========================================================================
# Stdlib ridge via normal equations (X'X + lambda*I)^-1 X'y on z-scored features.
# Solved with Gauss-Jordan on the (p+? ) system -- here NO intercept column because
# both X (z-scored) and y (de-meaned) are centered, so the intercept is 0 by construction.
# ===========================================================================
def _solve_linear_system(A, b):
    """Solve A x = b for square A (n x n) via Gauss-Jordan with partial pivoting. Stdlib."""
    n = len(A)
    # Build augmented matrix (copy).
    M = [list(A[i]) + [b[i]] for i in range(n)]
    for col in range(n):
        # partial pivot
        piv = max(range(col, n), key=lambda r: abs(M[r][col]))
        if abs(M[piv][col]) < 1e-15:
            raise ValueError("singular matrix in ridge solve (should not happen with lambda>0)")
        if piv != col:
            M[col], M[piv] = M[piv], M[col]
        pivval = M[col][col]
        inv = 1.0 / pivval
        for j in range(col, n + 1):
            M[col][j] *= inv
        for r in range(n):
            if r == col:
                continue
            factor = M[r][col]
            if factor == 0.0:
                continue
            for j in range(col, n + 1):
                M[r][j] -= factor * M[col][j]
    return [M[i][n] for i in range(n)]


def ridge_fit(X, y, lam):
    """Ridge coefficients for z-scored X (rows) and centered y. Returns weight vector (p,).
    Intercept omitted (centered data). Normal equations: (X'X + lam*I) w = X'y."""
    n = len(X)
    p = len(X[0]) if n else 0
    # X'X
    XtX = [[0.0] * p for _ in range(p)]
    Xty = [0.0] * p
    for i in range(n):
        xi = X[i]
        yi = y[i]
        for a in range(p):
            xa = xi[a]
            Xty[a] += xa * yi
            row = XtX[a]
            for b in range(a, p):
                row[b] += xa * xi[b]
    # symmetrize + ridge penalty on the diagonal
    for a in range(p):
        for b in range(a + 1, p):
            XtX[b][a] = XtX[a][b]
        XtX[a][a] += lam
    return _solve_linear_system(XtX, Xty)


def predict(X, w):
    return [sum(w[j] * row[j] for j in range(len(w))) for row in X]


# ===========================================================================
# Standardization helpers (train-only stats; G1/G2).
# ===========================================================================
def fit_feature_standardizer(X_rows):
    """Per-feature train mean/sd over a stack of raw feature rows. pstdev; sd=0 -> 1.0 guard."""
    p = len(X_rows[0])
    means, sds = [], []
    for j in range(p):
        col = [row[j] for row in X_rows]
        m = statistics.fmean(col)
        sd = statistics.pstdev(col)
        means.append(m)
        sds.append(sd if sd > 0.0 else 1.0)
    return means, sds


def apply_standardizer(X_rows, means, sds):
    return [[(row[j] - means[j]) / sds[j] for j in range(len(means))] for row in X_rows]


# ===========================================================================
# Delta-Spearman scoring on a per-country prediction vs target (single source: spearman_r/diff)
# ===========================================================================
def delta_spearman(pred, target):
    """Spearman of diff(pred) vs diff(target). None if degenerate."""
    if len(pred) < 3:
        return None
    return spearman_r(diff(pred), diff(target))


# ===========================================================================
# CORE: fit pooled ridge with TRAIN-ONLY everything, pick lambda by nested inner split,
# then score OOS. Returns the full freeze-ordered result dict.
# ===========================================================================
def run_gap_closer(panel, common_months):
    iso3s = sorted(panel.keys())

    # ----- protocol (c): global chronological 60/40 split on the rectangular month index -----
    n_months = len(common_months)
    # Ratified split is 81 train / 55 test of 136 (Ji-Hoon protocol (c)). 136*0.6 = 81.6;
    # take the FIRST 60% strictly (floor/truncate) -> 81 train, never spilling a 82nd month
    # of test signal into train.
    n_train = int(n_months * TRAIN_FRAC)             # int(81.6) = 81 of 136
    train_months = common_months[:n_train]
    test_months = common_months[n_train:]
    split_boundary = {
        "n_months_total": n_months,
        "n_train": n_train,
        "n_test": n_months - n_train,
        "train_window": train_months[0] + " to " + train_months[-1],
        "test_window": test_months[0] + " to " + test_months[-1],
        "train_test_frac": TRAIN_FRAC,
    }
    train_set = set(train_months)
    test_set = set(test_months)

    # Helper: split a country's rows into train/test by month membership (rectangular -> aligned).
    def country_split(iso3):
        months = panel[iso3]["months"]
        X = panel[iso3]["X"]
        y = panel[iso3]["y"]
        tr = [(X[i], y[i]) for i, m in enumerate(months) if m in train_set]
        te = [(X[i], y[i]) for i, m in enumerate(months) if m in test_set]
        return tr, te

    # ----- G1: per-country TRAIN-ONLY target de-mean constants (frozen) -----
    demean = {}
    for iso3 in iso3s:
        tr, _ = country_split(iso3)
        y_train = [t[1] for t in tr]
        demean[iso3] = statistics.fmean(y_train)

    # ----- Build the POOLED TRAIN stack (raw features + de-meaned target) -----
    X_train_raw, y_train_dm, owner_train = [], [], []
    for iso3 in iso3s:
        tr, _ = country_split(iso3)
        mu = demean[iso3]
        for (xrow, yval) in tr:
            X_train_raw.append(xrow)
            y_train_dm.append(yval - mu)
            owner_train.append(iso3)

    # ----- G2: TRAIN-ONLY feature standardizer (z-score), frozen -----
    feat_means, feat_sds = fit_feature_standardizer(X_train_raw)
    X_train_z = apply_standardizer(X_train_raw, feat_means, feat_sds)

    # ----- protocol (d): nested chronological inner split INSIDE train to pick lambda -----
    inner_n_train = int(round(n_train * INNER_TRAIN_FRAC))          # 65 of 81
    inner_train_months = set(train_months[:inner_n_train])
    inner_val_months = set(train_months[inner_n_train:])

    # Inner de-mean uses INNER-TRAIN-ONLY target means (no leakage into the inner val fold).
    inner_demean = {}
    for iso3 in iso3s:
        months = panel[iso3]["months"]
        y = panel[iso3]["y"]
        yv = [y[i] for i, m in enumerate(months) if m in inner_train_months]
        inner_demean[iso3] = statistics.fmean(yv) if yv else 0.0

    # Inner-train pooled stack (raw -> standardized on inner-train stats).
    Xi_raw, yi_dm = [], []
    for iso3 in iso3s:
        months = panel[iso3]["months"]
        X = panel[iso3]["X"]
        y = panel[iso3]["y"]
        mu = inner_demean[iso3]
        for i, m in enumerate(months):
            if m in inner_train_months:
                Xi_raw.append(X[i])
                yi_dm.append(y[i] - mu)
    inner_means, inner_sds = fit_feature_standardizer(Xi_raw)
    Xi_z = apply_standardizer(Xi_raw, inner_means, inner_sds)

    def inner_val_mean_delta_spearman(lam):
        w = ridge_fit(Xi_z, yi_dm, lam)
        scores = []
        for iso3 in iso3s:
            months = panel[iso3]["months"]
            X = panel[iso3]["X"]
            y = panel[iso3]["y"]
            idx = [i for i, m in enumerate(months) if m in inner_val_months]
            if len(idx) < 3:
                continue
            Xv_raw = [X[i] for i in idx]
            Xv_z = apply_standardizer(Xv_raw, inner_means, inner_sds)
            pred = predict(Xv_z, w)   # de-meaned scale; differencing removes the constant anyway
            tgt = [y[i] for i in idx]
            ds = delta_spearman(pred, tgt)
            if ds is not None:
                scores.append(ds)
        return statistics.fmean(scores) if scores else None

    sweep = []
    for lam in LAMBDA_GRID:
        sweep.append({"lambda": lam, "inner_val_mean_delta_spearman": inner_val_mean_delta_spearman(lam)})

    valid = [s for s in sweep if s["inner_val_mean_delta_spearman"] is not None]
    selection_path = "sweep"
    chosen_lambda = LAMBDA_SANE_DEFAULT
    if valid:
        best = max(valid, key=lambda s: s["inner_val_mean_delta_spearman"])
        best_lam = best["lambda"]
        scores_only = [s["inner_val_mean_delta_spearman"] for s in valid]
        spread = max(scores_only) - min(scores_only)
        at_grid_edge = (best_lam == LAMBDA_GRID[0] or best_lam == LAMBDA_GRID[-1])
        if at_grid_edge or spread < INNER_NOISE_EPS:
            # Pre-registered sane-default fallback (protocol (d)).
            selection_path = "sane_default_fallback"
            chosen_lambda = LAMBDA_SANE_DEFAULT
        else:
            selection_path = "sweep"
            chosen_lambda = best_lam
    else:
        selection_path = "sane_default_fallback"
        chosen_lambda = LAMBDA_SANE_DEFAULT

    # ----- Refit on ALL 81 train months at chosen lambda; FREEZE -----
    w_final = ridge_fit(X_train_z, y_train_dm, chosen_lambda)

    # ===================================================================
    # OOS scoring -- test window read ONLY now, after every constant is frozen (G6).
    # Per-country: OOS delta-Spearman (HEADLINE), OOS levels-Pearson (diagnostic),
    # plus the NAIVE baseline's OOS delta-Spearman on the IDENTICAL test months (G3),
    # and the in-sample (train) delta-Spearman for the overfit gap.
    # ===================================================================
    fips_to_iso3 = load_fips_to_iso3()
    # we also need gpr_share (the naive proxy) on the test months for G3 -> reload it.
    naive_proxy = load_naive_gpr_share(CSV_PATH, fips_to_iso3)

    per_country = []
    for iso3 in iso3s:
        months = panel[iso3]["months"]
        X = panel[iso3]["X"]
        y = panel[iso3]["y"]

        test_idx = [i for i, m in enumerate(months) if m in test_set]
        train_idx = [i for i, m in enumerate(months) if m in train_set]

        # --- gap-closer OOS predictions on test ---
        Xte_raw = [X[i] for i in test_idx]
        Xte_z = apply_standardizer(Xte_raw, feat_means, feat_sds)
        pred_te = predict(Xte_z, w_final)
        y_te = [y[i] for i in test_idx]

        oos_delta_spear = delta_spearman(pred_te, y_te)
        oos_pearson_levels = pearson_r(pred_te, y_te)   # diagnostic (trend-inflated; de-meaned pred)

        # --- gap-closer in-sample (train) delta-Spearman for overfit gap ---
        Xtr_raw = [X[i] for i in train_idx]
        Xtr_z = apply_standardizer(Xtr_raw, feat_means, feat_sds)
        pred_tr = predict(Xtr_z, w_final)
        y_tr = [y[i] for i in train_idx]
        ins_delta_spear = delta_spearman(pred_tr, y_tr)

        # --- naive baseline OOS delta-Spearman on the SAME test months (G3) ---
        nmap = naive_proxy.get(iso3, {})
        test_m_sorted = [months[i] for i in test_idx]
        naive_vals = [nmap.get(m) for m in test_m_sorted]
        if all(v is not None for v in naive_vals) and len(naive_vals) >= 3:
            naive_oos_delta_spear = delta_spearman(naive_vals, y_te)
            naive_oos_pearson_levels = pearson_r(naive_vals, y_te)
        else:
            naive_oos_delta_spear = None
            naive_oos_pearson_levels = None

        per_country.append({
            "iso3": iso3,
            "n_test_months": len(test_idx),
            "oos_delta_spearman": oos_delta_spear,
            "oos_pearson_levels": oos_pearson_levels,
            "in_sample_delta_spearman": ins_delta_spear,
            "naive_oos_delta_spearman": naive_oos_delta_spear,
            "naive_oos_pearson_levels": naive_oos_pearson_levels,
            "beats_naive_oos": (
                oos_delta_spear is not None and naive_oos_delta_spear is not None
                and oos_delta_spear >= naive_oos_delta_spear
            ),
        })

    # ----- aggregates -----
    gc_ds = [c["oos_delta_spearman"] for c in per_country if c["oos_delta_spearman"] is not None]
    gc_pl = [c["oos_pearson_levels"] for c in per_country if c["oos_pearson_levels"] is not None]
    gc_ins = [c["in_sample_delta_spearman"] for c in per_country if c["in_sample_delta_spearman"] is not None]
    naive_ds = [c["naive_oos_delta_spearman"] for c in per_country if c["naive_oos_delta_spearman"] is not None]

    mean_gc_oos_ds = statistics.fmean(gc_ds) if gc_ds else None
    mean_gc_oos_pl = statistics.fmean(gc_pl) if gc_pl else None
    mean_gc_ins_ds = statistics.fmean(gc_ins) if gc_ins else None
    mean_naive_oos_ds = statistics.fmean(naive_ds) if naive_ds else None

    n_beats = sum(1 for c in per_country if c["beats_naive_oos"])
    n_ge_09_levels = sum(1 for c in per_country
                         if c["oos_pearson_levels"] is not None and c["oos_pearson_levels"] >= PRODUCTION_FIDELITY_BAR)
    n_negative = sum(1 for c in per_country
                     if c["oos_delta_spearman"] is not None and c["oos_delta_spearman"] < 0)
    overfit_gap = (mean_gc_ins_ds - mean_gc_oos_ds) if (mean_gc_ins_ds is not None and mean_gc_oos_ds is not None) else None

    # ----- protocol (e): pre-registered ship bars -----
    bar1 = mean_gc_oos_ds is not None and mean_gc_oos_ds >= BAR1_MEAN_DELTA_SPEARMAN
    bar2 = n_beats >= BAR2_MIN_COUNTRIES_BEAT
    bar3 = overfit_gap is not None and overfit_gap <= BAR3_MAX_OVERFIT_GAP
    bar4 = n_negative == 0
    ship = bool(bar1 and bar2 and bar3 and bar4)

    # G6 -- freeze order recorded explicitly, OOS LAST.
    result = {
        "experiment": "F-GPR-1 learned gap-closer (Ji-Hoon ratified protocol)",
        "model": "pooled ridge (L2) linear, stdlib normal equations, per-country target de-mean (train-only)",
        # --- FREEZE ORDER (G6): constants in the order they were frozen, OOS last ---
        "freeze_order": {
            "1_feature_list": FEATURE_NAMES,
            "1_features_excluded": ["gpr_share (=naive proxy/baseline)", "raw g1..g8 counts", "total_docs"],
            "2_split_boundary": split_boundary,
            "3_train_only_feature_standardizer": {
                "means": dict(zip(FEATURE_NAMES, feat_means)),
                "sds": dict(zip(FEATURE_NAMES, feat_sds)),
            },
            "4_train_only_demean_constants_per_country": demean,
            "5_lambda_selection": {
                "grid": LAMBDA_GRID,
                "inner_split": {
                    "inner_train_months": train_months[0] + " to " + train_months[inner_n_train - 1],
                    "inner_val_months": train_months[inner_n_train] + " to " + train_months[-1],
                    "inner_n_train": inner_n_train,
                    "inner_n_val": n_train - inner_n_train,
                },
                "sweep": sweep,
                "selection_path": selection_path,
                "chosen_lambda": chosen_lambda,
            },
            "6_final_weights_zscored_features": dict(zip(FEATURE_NAMES, w_final)),
            "7_OOS_metrics_computed_last": True,
        },
        # --- per-country OOS panel (G7: all 44, win or lose) ---
        "per_country": per_country,
        # --- aggregates ---
        "n_countries": len(per_country),
        "gapcloser_oos_mean_delta_spearman": mean_gc_oos_ds,
        "gapcloser_oos_mean_pearson_levels": mean_gc_oos_pl,
        "gapcloser_in_sample_mean_delta_spearman": mean_gc_ins_ds,
        "naive_oos_mean_delta_spearman": mean_naive_oos_ds,
        "naive_reference_full_window": NAIVE_REFERENCE,
        "in_sample_vs_oos_gap": overfit_gap,
        "n_countries_oos_pearson_levels_ge_0.9": n_ge_09_levels,
        "n_countries_gapcloser_beats_naive_oos": n_beats,
        "n_countries_negative_oos_delta_spearman": n_negative,
        # --- pre-registered bars (protocol (e)) ---
        "bars": {
            "bar1_mean_oos_delta_spearman_ge_0.51": {
                "pass": bool(bar1), "value": mean_gc_oos_ds, "threshold": BAR1_MEAN_DELTA_SPEARMAN,
            },
            "bar2_beats_naive_in_ge_30_countries": {
                "pass": bool(bar2), "value": n_beats, "threshold": BAR2_MIN_COUNTRIES_BEAT,
            },
            "bar3_overfit_gap_le_0.10": {
                "pass": bool(bar3), "value": overfit_gap, "threshold": BAR3_MAX_OVERFIT_GAP,
            },
            "bar4_zero_negative_oos": {
                "pass": bool(bar4), "value": n_negative, "threshold": 0,
            },
        },
        "SHIP_gapcloser_over_naive": ship,
        "verdict": (
            "SHIP the learned gap-closer over the naive 0.46 blend (all 4 pre-registered bars cleared OOS)."
            if ship else
            "KEEP THE NAIVE 0.46 blend. A learned re-weighting of GDELT categories does not clear the "
            "pre-registered bar OOS; the gap is corpus (GDELT machine-coded vs Iacoviello's broadsheets), "
            "not weighting. Clean null = the finding."
        ),
        "production_fidelity_note": (
            "r>=0.9 is the PRODUCTION levels-fidelity gate against Iacoviello's OWN corpus and is NOT this "
            "experiment's bar -- a re-weighting of the same GDELT signal cannot manufacture corpus fidelity "
            "it does not have. Reported here (n at OOS levels-Pearson>=0.9) as a diagnostic only."
        ),
    }
    return result


def load_naive_gpr_share(csv_path, fips_to_iso3):
    """{ISO3: {YYYY-MM: gpr_share}} -- the naive blended proxy (the baseline we must beat)."""
    by_iso3 = {}
    with open(csv_path, newline="", encoding="utf-8") as f:
        rd = csv.DictReader(f)
        for row in rd:
            iso3 = fips_to_iso3.get(row["country_code"])
            if iso3 is None:
                continue
            try:
                if float(row["total_docs"]) <= 0:
                    continue
                val = float(row["gpr_share"])
            except (ValueError, KeyError):
                continue
            by_iso3.setdefault(iso3, {})[row["month"]] = val
    return by_iso3


# ===========================================================================
# Driver
# ===========================================================================
def main():
    fips_to_iso3 = load_fips_to_iso3()
    features_by_iso3, share_flags, skipped = load_features(CSV_PATH, fips_to_iso3)
    gprc_by_iso3, _present = load_all_gprc(XLS_PATH)

    panel, common_months = build_panel(features_by_iso3, gprc_by_iso3)

    result = run_gap_closer(panel, common_months)
    result["data_hygiene"] = {
        "n_share_out_of_range_flags": len(share_flags),
        "share_out_of_range_flags": share_flags[:50],
        "n_months_skipped": len(skipped),
        "months_skipped": skipped[:50],
        "csv": CSV_PATH,
        "xls": XLS_PATH,
        "n_mapped_iso3": len(panel),
    }

    with open(RESULTS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    # concise console summary
    print("=== F-GPR-1 GAP-CLOSER RESULTS ===")
    print("chosen lambda:", result["freeze_order"]["5_lambda_selection"]["chosen_lambda"],
          "(", result["freeze_order"]["5_lambda_selection"]["selection_path"], ")")
    print("gap-closer OOS mean delta-Spearman:", result["gapcloser_oos_mean_delta_spearman"])
    print("naive      OOS mean delta-Spearman:", result["naive_oos_mean_delta_spearman"])
    print("gap-closer OOS mean Pearson-levels:", result["gapcloser_oos_mean_pearson_levels"])
    print("countries OOS Pearson-levels>=0.9 :", result["n_countries_oos_pearson_levels_ge_0.9"])
    print("countries gap-closer beats naive  :", result["n_countries_gapcloser_beats_naive_oos"], "/ 44")
    print("countries negative OOS dSpearman  :", result["n_countries_negative_oos_delta_spearman"])
    print("in-sample vs OOS gap (overfit)    :", result["in_sample_vs_oos_gap"])
    print("bars:", json.dumps({k: v["pass"] for k, v in result["bars"].items()}))
    print("SHIP:", result["SHIP_gapcloser_over_naive"])
    print("verdict:", result["verdict"])
    return result


if __name__ == "__main__":
    main()
