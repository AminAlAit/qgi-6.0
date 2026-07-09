"""Independent leakage stress test (reviewer's own script, not reusing build_features.py's
internal proof) -- confirm one_sided_gap[Y] is invariant to appending future data."""
import numpy as np
import pandas as pd
import sys
sys.path.insert(0, ".")
from build_features import one_sided_gap, build_credit_growth

rng = np.random.default_rng(999)

# --- Test 1: one-sided HP gap must be invariant to appending future years ---
n1 = 40
years1 = np.arange(1980, 1980 + n1)
vals1 = np.cumsum(rng.normal(0, 2, n1)) + 50
s1 = pd.Series(vals1, index=years1)
gap1 = one_sided_gap(s1)

# extend with 25 MORE future years, DIFFERENT random draw (adversarial: not just more of the same trend)
n2 = 25
years2 = np.arange(1980 + n1, 1980 + n1 + n2)
vals2 = np.cumsum(rng.normal(5, 10, n2)) + vals1[-1]  # different regime: big drift + high vol shock
years_full = np.concatenate([years1, years2])
vals_full = np.concatenate([vals1, vals2])
s2 = pd.Series(vals_full, index=years_full)
gap2 = one_sided_gap(s2)

# compare on overlapping years (1980..2019)
common = years1
diffs = [(y, gap1[y], gap2[y], abs(gap1[y]-gap2[y])) for y in common if not np.isnan(gap1[y])]
max_diff = max(d[3] for d in diffs)
print(f"[TEST 1] one_sided_gap truncation-invariance: max abs diff over {len(diffs)} overlapping years = {max_diff:.2e}")
assert max_diff < 1e-9, f"LEAKAGE DETECTED: appending future data changed a past gap value! max_diff={max_diff}"
print("[TEST 1] PASS - no look-ahead leakage in one_sided_gap")

# --- Test 2: single-point perturbation of the LAST year of history must not
# change the gap at any earlier year (adversarial: even the shape trick could
# leak if the solver were mis-sliced) ---
vals3 = vals1.copy()
vals3[-1] += 1000.0  # huge perturbation only at the final (most recent) observed year
s3 = pd.Series(vals3, index=years1)
gap3 = one_sided_gap(s3)
diffs2 = [abs(gap1[y] - gap3[y]) for y in years1[:-1] if not np.isnan(gap1[y])]
max_diff2 = max(diffs2) if diffs2 else 0.0
print(f"[TEST 2] perturbing only the final year: max abs diff on all EARLIER years = {max_diff2:.2e}")
assert max_diff2 < 1e-9, f"LEAKAGE: perturbing the final obs changed an earlier gap! max_diff={max_diff2}"
print("[TEST 2] PASS - perturbing the newest observation cannot retroactively change earlier gaps")

# --- Test 3: growth (C2) construction sanity: value at Y must equal level_Y - level_{Y-3}
# regardless of what values exist AFTER Y ---
raw = pd.DataFrame({"country": ["X"]*10, "year": np.arange(2000,2010), "value": np.arange(10)*3.0})
g_full = build_credit_growth(raw, "test")
raw_truncated = raw[raw["year"] <= 2005]
g_trunc = build_credit_growth(raw_truncated, "test")
g_full_idx = g_full.set_index("year")["value"]
g_trunc_idx = g_trunc.set_index("year")["value"]
common_yrs = sorted(set(g_full_idx.index) & set(g_trunc_idx.index))
diffs3 = [abs(g_full_idx[y]-g_trunc_idx[y]) for y in common_yrs]
print(f"[TEST 3] growth(C2) truncation-invariance over {len(common_yrs)} years: max diff = {max(diffs3):.2e}")
assert max(diffs3) < 1e-9
print("[TEST 3] PASS")

print("\nALL LEAKAGE STRESS TESTS PASSED (independently authored, not reusing build_features.py's own proof)")
