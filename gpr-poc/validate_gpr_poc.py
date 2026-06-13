"""
GDELT -> GPR Proof-of-Concept validation (build agent ALPHA).

Tests whether a CRUDE 2-topic GDELT topic-share proxy TRACKS Caldara-Iacoviello's
real country Geopolitical Risk index (GPRC_<ISO3>) over the overlapping months,
for the countries where we have a ground-truth GPRC column.

PRE-REGISTERED PROTOCOL (frozen before results; see Ji-Hoon + Kwame ratification):
  PRIMARY proxy   = (t02 Armed Conflict + t03 Terrorism) / total_docs   [verdict-bearing]
  EXPLORATORY     = (t02+t03+t05)/total_docs  and  (t02)/total_docs     [never the verdict]

Ji-Hoon must-fix corrections honored here:
  (1) The shared global news-volume trend inflates levels-Pearson. The HEADLINE metric is
      therefore Spearman on month-over-month CHANGES (delta). Levels-Pearson is still
      reported but flagged "trend-inflated; diagnostic only".
  (2) The 2015-2019 / 2020+ split is a TEMPORAL-STABILITY descriptor, not an OOS gate
      (the proxy has no fitted parameters). Reported, never gating.
  (3) Spikes are defined on the DE-TRENDED series (here: top-decile of |delta GPRC| vs
      top-quartile of |delta proxy|) with the 0.25 chance baseline stated.

Mapping is FROZEN. No tuning on results. All 5 overlap countries reported, win or lose.

Stdlib + xlrd only (pandas is NOT installed). Reads:
  data/gpr_export.xls          (Caldara-Iacoviello GPR export; xlrd, single sheet, row0 header)
  data/topic_monthly.csv       (GDELT monthly Topic counts per country; stdlib csv)
"""

import csv
import json
import math
import os
import statistics

import xlrd
from xlrd.xldate import xldate_as_datetime

_HERE = os.path.dirname(os.path.abspath(__file__))
XLS_PATH = os.path.join(_HERE, "data", "gpr_export.xls")
CSV_PATH = os.path.join(_HERE, "data", "topic_monthly.csv")
OUT_PATH = os.path.join(_HERE, "gpr-poc-results-alpha.json")

# Our 12 countries: ISO3 -> CSV country_code (FIPS-style codes actually used in the file,
# verified by inspection: BG=Bangladesh, BM=Myanmar, LE=Lebanon, NI=Nigeria, SU=Sudan, TS=Tunisia).
ISO3_TO_CSV = {
    "ARG": "AR", "BGD": "BG", "EGY": "EG", "IRN": "IR", "LBN": "LE",
    "MMR": "BM", "NGA": "NI", "PAK": "PK", "SDN": "SU", "THA": "TH",
    "TUN": "TS", "VEN": "VE",
}

OOS_SPLIT_YEAR = 2020  # 2015-2019 vs 2020+


# ----------------------------------------------------------------------------
# Statistics helpers (no scipy/numpy available)
# ----------------------------------------------------------------------------
def pearson_r(xs, ys):
    """Pearson correlation. Returns None if undefined (n<2 or zero variance)."""
    n = len(xs)
    if n < 2 or len(ys) != n:
        return None
    mx = statistics.fmean(xs)
    my = statistics.fmean(ys)
    sxy = sxx = syy = 0.0
    for x, y in zip(xs, ys):
        dx = x - mx
        dy = y - my
        sxy += dx * dy
        sxx += dx * dx
        syy += dy * dy
    denom = math.sqrt(sxx * syy)
    if denom == 0.0:
        return None
    return sxy / denom


def _rank_with_ties(vals):
    """Average ranks (1-based), ties get the mean of their rank positions."""
    order = sorted(range(len(vals)), key=lambda i: vals[i])
    ranks = [0.0] * len(vals)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and vals[order[j + 1]] == vals[order[i]]:
            j += 1
        avg = (i + j) / 2.0 + 1.0  # average of 1-based positions i+1..j+1
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    return ranks


def spearman_r(xs, ys):
    """Spearman correlation = Pearson on average ranks. Tie-safe."""
    n = len(xs)
    if n < 2 or len(ys) != n:
        return None
    return pearson_r(_rank_with_ties(xs), _rank_with_ties(ys))


def zscore(vals):
    """Standardize to mean 0 / sd 1 (population sd). Returns zeros if zero variance."""
    if len(vals) < 2:
        return [0.0] * len(vals)
    m = statistics.fmean(vals)
    sd = statistics.pstdev(vals)
    if sd == 0.0:
        return [0.0] * len(vals)
    return [(v - m) / sd for v in vals]


def rmse(xs, ys):
    if not xs:
        return None
    return math.sqrt(statistics.fmean([(a - b) ** 2 for a, b in zip(xs, ys)]))


def diff(series):
    """Month-over-month first difference. Length n-1."""
    return [series[i] - series[i - 1] for i in range(1, len(series))]


def quantile_threshold(vals, q):
    """Value at quantile q (0..1) via linear interpolation on sorted data."""
    if not vals:
        return None
    s = sorted(vals)
    if len(s) == 1:
        return s[0]
    pos = q * (len(s) - 1)
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return s[lo]
    frac = pos - lo
    return s[lo] * (1 - frac) + s[hi] * frac


def spike_recall(gprc_delta, proxy_delta):
    """De-trended spike recall (Ji-Hoon must-fix #3).

    Spike (his side)   = month in top decile of |delta GPRC| (elevated-risk jump).
    Catch (our side)   = month in top quartile of |delta proxy|.
    Recall = fraction of his spike-months that we also flag.
    Chance baseline = 0.25 (top-quartile guessing). Reported separately.
    """
    ag = [abs(v) for v in gprc_delta]
    ap = [abs(v) for v in proxy_delta]
    if len(ag) < 4:
        return None, 0
    g_thr = quantile_threshold(ag, 0.90)  # top decile boundary
    p_thr = quantile_threshold(ap, 0.75)  # top quartile boundary
    spike_idx = [i for i, v in enumerate(ag) if v >= g_thr]
    if not spike_idx:
        return None, 0
    caught = sum(1 for i in spike_idx if ap[i] >= p_thr)
    return caught / len(spike_idx), len(spike_idx)


# ----------------------------------------------------------------------------
# Data loading
# ----------------------------------------------------------------------------
def load_gprc(path):
    """Return {ISO3: {YYYY-MM: gprc_value}} for the overlap ISO3s, plus the set of
    GPRC_* ISO3 columns present in the file."""
    wb = xlrd.open_workbook(path)
    sh = wb.sheet_by_index(0)
    hdr = [str(h) for h in sh.row_values(0)]
    month_col = hdr.index("month")

    present_iso3 = set()
    col_for_iso3 = {}
    for i, h in enumerate(hdr):
        if h.startswith("GPRC_"):
            iso3 = h[len("GPRC_"):]
            present_iso3.add(iso3)
            col_for_iso3[iso3] = i

    wanted = {iso3: col_for_iso3[iso3] for iso3 in ISO3_TO_CSV if iso3 in col_for_iso3}

    out = {iso3: {} for iso3 in wanted}
    for r in range(1, sh.nrows):
        serial = sh.cell_value(r, month_col)
        # Robust month conversion: xldate_as_datetime handles serial 1.0 without the
        # XLDateAmbiguous error that xldate_as_tuple raises. Handle string/int forms too.
        ym = None
        if isinstance(serial, (int, float)) and serial:
            dt = xldate_as_datetime(serial, wb.datemode)
            ym = "%04d-%02d" % (dt.year, dt.month)
        elif isinstance(serial, str) and serial.strip():
            s = serial.strip()
            if "-" in s:                       # already YYYY-MM[-...]
                ym = s[:7]
            elif len(s) == 6 and s.isdigit():  # YYYYMM
                ym = s[:4] + "-" + s[4:]
        if ym is None:
            continue
        for iso3, col in wanted.items():
            v = sh.cell_value(r, col)
            if isinstance(v, (int, float)) and not (isinstance(v, str)):
                # Empty cells in the xls come through as '' (string) for the pre-1985 rows.
                out[iso3][ym] = float(v)
    return out, present_iso3


def load_proxy(path):
    """Return {CSV_code: {YYYY-MM: {primary, alt_t05, alt_t02}}}.
    Skips months with total_docs == 0. Flags shares outside [0,1]."""
    by_code = {}
    flags = []
    with open(path, newline="", encoding="utf-8") as f:
        rd = csv.DictReader(f)
        for row in rd:
            code = row["country_code"]
            ym = row["month"]
            try:
                total = float(row["total_docs"])
                t02 = float(row["t02"])
                t03 = float(row["t03"])
                t05 = float(row["t05"])
            except (ValueError, KeyError):
                continue
            if total <= 0:
                continue  # GOTCHA: skip zero-doc months
            primary = (t02 + t03) / total
            alt_t05 = (t02 + t03 + t05) / total
            alt_t02 = t02 / total
            # Pre-registered guard: a share > 1 means a topic-counting assumption broke.
            # Surface it, do not silently clamp.
            for name, val in (("primary", primary), ("alt_t05", alt_t05), ("alt_t02", alt_t02)):
                if not (0.0 <= val <= 1.0):
                    flags.append({"code": code, "month": ym, "mapping": name, "value": val})
            by_code.setdefault(code, {})[ym] = {
                "primary": primary, "alt_t05": alt_t05, "alt_t02": alt_t02,
            }
    return by_code, flags


# ----------------------------------------------------------------------------
# Alignment + per-country metrics
# ----------------------------------------------------------------------------
def aligned_months(gprc_map, proxy_map, key):
    """Return sorted overlap months and paired (proxy, gprc) value lists for one mapping key."""
    months = sorted(set(gprc_map) & set(proxy_map))
    px = [proxy_map[m][key] for m in months]
    gp = [gprc_map[m] for m in months]
    return months, px, gp


def country_metrics(iso3, gprc_map, proxy_map):
    months, px, gp = aligned_months(gprc_map, proxy_map, "primary")
    n = len(months)
    if n < 3:
        return None

    # Levels (diagnostic, trend-inflated)
    pearson_levels = pearson_r(px, gp)
    spearman_levels = spearman_r(px, gp)

    # Headline: month-over-month changes (de-trended)
    px_d = diff(px)
    gp_d = diff(gp)
    spearman_delta = spearman_r(px_d, gp_d)   # HEADLINE
    pearson_delta = pearson_r(px_d, gp_d)

    # RMSE on z-standardized levels
    rmse_z = rmse(zscore(px), zscore(gp))

    # Temporal-stability split (NOT a gate): on levels-Pearson per Ji-Hoon's reporting,
    # plus delta-Spearman per window for the robustness panel.
    def window(lo_year, hi_year):
        idx = [i for i, m in enumerate(months)
               if lo_year <= int(m[:4]) <= hi_year]
        if len(idx) < 3:
            return None, None, 0
        wpx = [px[i] for i in idx]
        wgp = [gp[i] for i in idx]
        wpx_d = diff(wpx)
        wgp_d = diff(wgp)
        return pearson_r(wpx, wgp), spearman_r(wpx_d, wgp_d), len(idx)

    p_early, sp_early, n_early = window(0, OOS_SPLIT_YEAR - 1)
    p_late, sp_late, n_late = window(OOS_SPLIT_YEAR, 9999)

    # Spike recall on de-trended series
    sr, n_spikes = spike_recall(gp_d, px_d)

    return {
        "iso3": iso3,
        "n_months": n,
        "window": months[0] + " to " + months[-1],
        # schema-required fields
        "pearson_r": pearson_levels,            # levels (diagnostic)
        "spearman_r": spearman_delta,           # HEADLINE = delta-Spearman
        "spike_recall": sr if sr is not None else 0.0,
        "pearson_r_2015_2019": p_early,
        "pearson_r_2020plus": p_late,
        "rmse_z": rmse_z,
        # extra diagnostics (kept for the record, not schema-required)
        "_pearson_levels": pearson_levels,
        "_spearman_levels": spearman_levels,
        "_pearson_delta": pearson_delta,
        "_spearman_delta_headline": spearman_delta,
        "_spearman_delta_2015_2019": sp_early,
        "_spearman_delta_2020plus": sp_late,
        "_n_early": n_early,
        "_n_late": n_late,
        "_n_spikes": n_spikes,
    }


def exploratory_mean_pearson(overlap, gprc, proxy_by_code, key):
    """Mean levels-Pearson r across overlap countries for an alternate mapping (exploratory)."""
    rs = []
    for iso3 in overlap:
        code = ISO3_TO_CSV[iso3]
        gmap = gprc[iso3]
        pmap = proxy_by_code.get(code, {})
        _, px, gp = aligned_months(gmap, pmap, key)
        r = pearson_r(px, gp)
        if r is not None:
            rs.append(r)
    return statistics.fmean(rs) if rs else None


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    gprc, present_iso3 = load_gprc(XLS_PATH)
    proxy_by_code, share_flags = load_proxy(CSV_PATH)

    # Overlap = our 12 INTERSECT GPRC_* columns present, AND present in the proxy CSV.
    overlap = sorted(
        iso3 for iso3 in ISO3_TO_CSV
        if iso3 in present_iso3 and ISO3_TO_CSV[iso3] in proxy_by_code
    )

    per_country = []
    for iso3 in overlap:
        code = ISO3_TO_CSV[iso3]
        m = country_metrics(iso3, gprc[iso3], proxy_by_code[code])
        if m is not None:
            per_country.append(m)

    # Aggregates: HEADLINE = mean delta-Spearman (spearman_r field) across overlap.
    headline_spear = [c["spearman_r"] for c in per_country if c["spearman_r"] is not None]
    levels_pear = [c["pearson_r"] for c in per_country if c["pearson_r"] is not None]
    delta_pear = [c["_pearson_delta"] for c in per_country if c["_pearson_delta"] is not None]
    recalls = [c["spike_recall"] for c in per_country]

    mean_spearman_r = statistics.fmean(headline_spear) if headline_spear else None
    mean_pearson_r = statistics.fmean(levels_pear) if levels_pear else None
    mean_pearson_delta = statistics.fmean(delta_pear) if delta_pear else None
    mean_spike_recall = statistics.fmean(recalls) if recalls else None

    # Exploratory alternates (levels-Pearson mean; NEVER the verdict).
    alt_t05 = exploratory_mean_pearson(overlap, gprc, proxy_by_code, "alt_t05")
    alt_t02 = exploratory_mean_pearson(overlap, gprc, proxy_by_code, "alt_t02")
    primary_mean_levels = exploratory_mean_pearson(overlap, gprc, proxy_by_code, "primary")

    # Pre-registered verdict (PRIMARY mapping, delta-Spearman ONLY):
    #   PASS = mean delta-Spearman >= 0.35 AND >=3/5 countries >=0.25 with none negative.
    n_ge_025 = sum(1 for c in per_country if (c["spearman_r"] or 0) >= 0.25)
    any_negative = any((c["spearman_r"] or 0) < 0 for c in per_country)
    primary_pass = (
        mean_spearman_r is not None and mean_spearman_r >= 0.35
        and n_ge_025 >= 3 and not any_negative
    )
    pooled_spike_recall = mean_spike_recall  # mean across the 5 (proxy for pooled, supporting)

    results = {
        "overlap_countries": overlap,
        "primary_mapping": "(t02+t03)/total_docs",
        "headline_metric": "delta-Spearman (month-over-month change), primary mapping only",
        "window": (per_country[0]["window"] if per_country else None),
        "per_country": [
            {
                "iso3": c["iso3"],
                "n_months": c["n_months"],
                "pearson_r": c["pearson_r"],
                "spearman_r": c["spearman_r"],
                "spike_recall": c["spike_recall"],
                "pearson_r_2015_2019": c["pearson_r_2015_2019"],
                "pearson_r_2020plus": c["pearson_r_2020plus"],
                "rmse_z": c["rmse_z"],
            }
            for c in per_country
        ],
        "per_country_diagnostics": per_country,
        "mean_pearson_r": mean_pearson_r,                 # levels (trend-inflated; diagnostic)
        "mean_pearson_r_note": "LEVELS Pearson - trend-inflated, DIAGNOSTIC ONLY, not the verdict",
        "mean_spearman_r": mean_spearman_r,               # HEADLINE = mean delta-Spearman
        "mean_spearman_r_note": "HEADLINE = mean month-over-month-change Spearman, primary mapping",
        "mean_pearson_delta": mean_pearson_delta,
        "mean_spike_recall": mean_spike_recall,
        "pooled_spike_recall_supporting": pooled_spike_recall,
        "spike_recall_chance_baseline": 0.25,
        "alternates": [
            {"mapping": "(t02+t03+t05)/total_docs", "mean_pearson_r": alt_t05},
            {"mapping": "(t02)/total_docs", "mean_pearson_r": alt_t02},
        ],
        "primary_mean_pearson_levels_for_reference": primary_mean_levels,
        "preregistered_verdict": {
            "metric": "mean delta-Spearman, primary mapping",
            "bar": "mean >= 0.35 AND >=3/5 countries >=0.25 AND none negative",
            "mean_delta_spearman": mean_spearman_r,
            "n_countries_ge_0.25": n_ge_025,
            "any_negative": any_negative,
            "PASS": primary_pass,
            "spike_recall_supporting_bar": "pooled >= 0.45 vs 0.25 chance",
            "pooled_spike_recall": pooled_spike_recall,
        },
        "share_out_of_range_flags": share_flags,
        "method_notes": (
            "PRIMARY proxy (t02+t03)/total_docs vs Caldara-Iacoviello GPRC_<ISO3>, "
            "monthly, overlap window only. HEADLINE = delta-Spearman (Ji-Hoon must-fix #1: "
            "levels-Pearson is trend-inflated on these non-stationary share series and is "
            "demoted to diagnostic). 2015-2019/2020+ split is a temporal-stability descriptor, "
            "NOT a gate (no fitted params; must-fix #2). Spike-recall on de-trended (delta) "
            "series, top-decile |dGPRC| vs top-quartile |dproxy|, chance baseline 0.25 "
            "(must-fix #3). Mapping FROZEN; t05/t02 alternates exploratory only, never the "
            "verdict. FIPS->ISO3 join (TUN=TS, MMR=BM, LBN=LE, BGD=BG, NGA=NI, SDN=SU); "
            "CSV 2026-06 dropped by month-intersection (xls ends 2026-05); total_docs==0 "
            "months skipped; share in [0,1] asserted and flagged not clamped. "
            "stdlib + xlrd only."
        ),
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(json.dumps(results, indent=2))
    return results


if __name__ == "__main__":
    main()
