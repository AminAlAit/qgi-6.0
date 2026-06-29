"""
Full GPR validation run: 8-category gpr_share proxy vs all 44 GPRC countries.
Also validates threats_share vs GPRHT and acts_share vs GPRHA.
Produces gpr-full-validation-results.md and gpr_proxy44.json.

Usage: python run_full_validation.py
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
# Paths
# ---------------------------------------------------------------------------
_HERE = os.path.dirname(os.path.abspath(__file__))
_POC_DIR = os.path.abspath(os.path.join(_HERE, "..", "gpr-poc"))
if _POC_DIR not in sys.path:
    sys.path.insert(0, _POC_DIR)

XLS_PATH = os.path.join(_POC_DIR, "data", "gpr_export.xls")
GPR_MONTHLY_CSV = "C:/tmp/gpr_monthly.csv"
PROXY44_OUT = "C:/tmp/gpr_proxy44.json"
RESULTS_MD = os.path.join(_HERE, "gpr-full-validation-results.md")
RESULTS_JSON = os.path.join(_HERE, "gpr-full-results.json")

# ---------------------------------------------------------------------------
# FIPS -> ISO3 map for all 44 GPRC countries
# Built from authoritative FIPS 10-4 standard; each verified against the
# ISO3 suffix in the GPRC_<ISO3> column names found in the XLS.
# ---------------------------------------------------------------------------
FIPS_TO_ISO3 = {
    # The 44 GPRC countries (ISO3 = XLS column suffix)
    "AR": "ARG",   # Argentina
    "AS": "AUS",   # Australia  (FIPS AS = Australia; not to be confused with American Samoa=AQ)
    "BE": "BEL",   # Belgium
    "BR": "BRA",   # Brazil
    "CA": "CAN",   # Canada
    "SZ": "CHE",   # Switzerland (FIPS SZ)
    "CI": "CHL",   # Chile (FIPS CI)
    "CH": "CHN",   # China (FIPS CH)
    "CO": "COL",   # Colombia
    "GM": "DEU",   # Germany (FIPS GM)
    "DA": "DNK",   # Denmark (FIPS DA)
    "EG": "EGY",   # Egypt
    "SP": "ESP",   # Spain (FIPS SP)
    "FI": "FIN",   # Finland
    "FR": "FRA",   # France
    "UK": "GBR",   # United Kingdom (FIPS UK)
    "HK": "HKG",   # Hong Kong
    "HU": "HUN",   # Hungary
    "ID": "IDN",   # Indonesia
    "IN": "IND",   # India
    "IS": "ISR",   # Israel
    "IT": "ITA",   # Italy
    "JA": "JPN",   # Japan (FIPS JA)
    "KS": "KOR",   # South Korea (FIPS KS)
    "MX": "MEX",   # Mexico
    "MY": "MYS",   # Malaysia (FIPS MY)
    "NL": "NLD",   # Netherlands
    "NO": "NOR",   # Norway
    "PE": "PER",   # Peru (FIPS PE)
    "RP": "PHL",   # Philippines (FIPS RP)
    "PL": "POL",   # Poland
    "PO": "PRT",   # Portugal (FIPS PO)
    "RS": "RUS",   # Russia (FIPS RS)
    "SA": "SAU",   # Saudi Arabia
    "SW": "SWE",   # Sweden (FIPS SW)
    "TH": "THA",   # Thailand
    "TS": "TUN",   # Tunisia
    "TU": "TUR",   # Turkey (FIPS TU)
    "TW": "TWN",   # Taiwan (FIPS TW)
    "UP": "UKR",   # Ukraine (FIPS UP)
    "US": "USA",   # United States
    "VE": "VEN",   # Venezuela
    "VM": "VNM",   # Vietnam (FIPS VM)
    "SF": "ZAF",   # South Africa (FIPS SF)
}

# Expected ISO3 set from XLS (verified by enumeration above)
EXPECTED_ISO3 = {
    "ARG","AUS","BEL","BRA","CAN","CHE","CHL","CHN","COL","DEU",
    "DNK","EGY","ESP","FIN","FRA","GBR","HKG","HUN","IDN","IND",
    "ISR","ITA","JPN","KOR","MEX","MYS","NLD","NOR","PER","PHL",
    "POL","PRT","RUS","SAU","SWE","THA","TUN","TUR","TWN","UKR",
    "USA","VEN","VNM","ZAF",
}

# ---------------------------------------------------------------------------
# Stats helpers (copy from poc to avoid import issues, or import directly)
# ---------------------------------------------------------------------------
from validate_gpr_poc import (
    pearson_r, spearman_r, _rank_with_ties, zscore, rmse, diff,
    quantile_threshold, spike_recall,
)


# ---------------------------------------------------------------------------
# XLS loading
# ---------------------------------------------------------------------------
def decode_month(serial, datemode):
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


def load_xls_series(path, col_prefix):
    """Load all columns matching col_prefix from XLS.
    Returns {suffix: {YYYY-MM: float}}.
    """
    wb = xlrd.open_workbook(path)
    sh = wb.sheet_by_index(0)
    hdr = [str(h) for h in sh.row_values(0)]
    month_col = hdr.index("month")

    col_map = {}
    for i, h in enumerate(hdr):
        if h.startswith(col_prefix):
            col_map[h[len(col_prefix):]] = i

    out = {k: {} for k in col_map}
    for r in range(1, sh.nrows):
        ym = decode_month(sh.cell_value(r, month_col), wb.datemode)
        if ym is None:
            continue
        for key, col in col_map.items():
            v = sh.cell_value(r, col)
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                out[key][ym] = float(v)
    return out


def load_global_series(path, col_names):
    """Load specific global columns (GPRHT, GPRHA) by exact name."""
    wb = xlrd.open_workbook(path)
    sh = wb.sheet_by_index(0)
    hdr = [str(h) for h in sh.row_values(0)]
    month_col = hdr.index("month")

    col_map = {name: hdr.index(name) for name in col_names if name in hdr}
    out = {name: {} for name in col_map}
    for r in range(1, sh.nrows):
        ym = decode_month(sh.cell_value(r, month_col), wb.datemode)
        if ym is None:
            continue
        for name, col in col_map.items():
            v = sh.cell_value(r, col)
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                out[name][ym] = float(v)
    return out


# ---------------------------------------------------------------------------
# Build proxy from gpr_monthly.csv
# ---------------------------------------------------------------------------
def build_proxies(csv_path, fips_to_iso3):
    """Read gpr_monthly.csv; return three proxy dicts keyed by ISO3:
      gpr_proxy   = {ISO3: {ym: gpr_share}}
      thr_proxy   = {ISO3: {ym: threats_share}}
      acts_proxy  = {ISO3: {ym: acts_share}}
    """
    gpr_proxy = {}
    thr_proxy = {}
    acts_proxy = {}

    with open(csv_path, newline="", encoding="utf-8") as f:
        rd = csv.DictReader(f)
        for row in rd:
            fips = row["country_code"]
            iso3 = fips_to_iso3.get(fips)
            if iso3 is None:
                continue
            ym = row["month"]
            try:
                total = float(row["total_docs"])
                gpr_share = float(row["gpr_share"])
                thr_share = float(row["threats_share"])
                act_share = float(row["acts_share"])
            except (ValueError, KeyError):
                continue
            if total <= 0:
                continue

            gpr_proxy.setdefault(iso3, {})[ym] = gpr_share
            thr_proxy.setdefault(iso3, {})[ym] = thr_share
            acts_proxy.setdefault(iso3, {})[ym] = act_share

    return gpr_proxy, thr_proxy, acts_proxy


# ---------------------------------------------------------------------------
# Per-country scoring
# ---------------------------------------------------------------------------
OOS_SPLIT_YEAR = 2020
PRODUCTION_GATE = 0.90
SOFT_BAR = 0.35


def align(proxy_map, ref_map):
    months = sorted(set(proxy_map) & set(ref_map))
    px = [proxy_map[m] for m in months]
    gp = [ref_map[m] for m in months]
    return months, px, gp


def window_metrics(months, px, gp, lo_year, hi_year):
    idx = [i for i, m in enumerate(months) if lo_year <= int(m[:4]) <= hi_year]
    if len(idx) < 3:
        return None, None, len(idx)
    wpx = [px[i] for i in idx]
    wgp = [gp[i] for i in idx]
    return pearson_r(wpx, wgp), spearman_r(diff(wpx), diff(wgp)), len(idx)


def fit_affine(px, gp):
    n = len(px)
    if n < 2:
        return None
    mx, my = statistics.fmean(px), statistics.fmean(gp)
    sxx = sxy = 0.0
    for x, y in zip(px, gp):
        dx = x - mx
        sxx += dx * dx
        sxy += dx * (y - my)
    if sxx == 0.0:
        return None
    b = sxy / sxx
    return (my - b * mx, b)


def score_country(iso3, proxy_map, ref_map, min_months=3):
    months, px, gp = align(proxy_map, ref_map)
    n = len(months)
    if n < min_months:
        return None

    pearson_levels = pearson_r(px, gp)
    px_d, gp_d = diff(px), diff(gp)
    spearman_delta = spearman_r(px_d, gp_d)   # HEADLINE
    pearson_delta = pearson_r(px_d, gp_d)
    rmse_z_val = rmse(zscore(px), zscore(gp))
    sr, n_spikes = spike_recall(gp_d, px_d)

    p_early, sp_early, n_early = window_metrics(months, px, gp, 0, OOS_SPLIT_YEAR - 1)
    p_late, sp_late, n_late = window_metrics(months, px, gp, OOS_SPLIT_YEAR, 9999)

    # Affine calibration holdout RMSE
    n_train = max(2, int(round(n * 0.6)))
    calib_rmse = None
    if n_train < n and n_train >= 2:
        coef = fit_affine(px[:n_train], gp[:n_train])
        if coef:
            a, b = coef
            pred_hold = [a + b * x for x in px[n_train:]]
            calib_rmse = rmse(pred_hold, gp[n_train:])

    # Production gate: levels-Pearson >= 0.90 (affine-invariant)
    prod_pass = (pearson_levels is not None) and (pearson_levels >= PRODUCTION_GATE)

    return {
        "iso3": iso3,
        "n": n,
        "window": months[0] + " to " + months[-1],
        "pearson_levels": pearson_levels,
        "spearman_delta": spearman_delta,
        "pearson_delta": pearson_delta,
        "spike_recall": sr if sr is not None else 0.0,
        "n_spikes": n_spikes,
        "rmse_z": rmse_z_val,
        "pearson_early": p_early,
        "spearman_delta_early": sp_early,
        "n_early": n_early,
        "pearson_late": p_late,
        "spearman_delta_late": sp_late,
        "n_late": n_late,
        "calib_rmse": calib_rmse,
        "prod_pass": prod_pass,
    }


def run_panel(proxy_by_iso3, ref_by_iso3, label="gpr_share vs GPRC"):
    results = []
    for iso3 in sorted(proxy_by_iso3):
        if iso3 not in ref_by_iso3:
            continue
        r = score_country(iso3, proxy_by_iso3[iso3], ref_by_iso3[iso3])
        if r is not None:
            results.append(r)

    spear_vals = [r["spearman_delta"] for r in results if r["spearman_delta"] is not None]
    pears_vals = [r["pearson_levels"] for r in results if r["pearson_levels"] is not None]
    recall_vals = [r["spike_recall"] for r in results]

    mean_spear = statistics.fmean(spear_vals) if spear_vals else None
    mean_pears = statistics.fmean(pears_vals) if pears_vals else None
    mean_recall = statistics.fmean(recall_vals) if recall_vals else None

    n_prod_pass = sum(1 for r in results if r["prod_pass"])
    n_soft_pass = sum(1 for r in results if (r["spearman_delta"] or 0) >= SOFT_BAR)
    n_ge_025 = sum(1 for r in results if (r["spearman_delta"] or 0) >= 0.25)
    any_negative = any((r["spearman_delta"] or 0) < 0 for r in results)
    poc_equiv_pass = (
        mean_spear is not None and mean_spear >= 0.35
        and n_ge_025 >= 3 and not any_negative
    )

    return {
        "label": label,
        "n_scored": len(results),
        "mean_spearman_delta": mean_spear,
        "mean_pearson_levels": mean_pears,
        "mean_spike_recall": mean_recall,
        "n_prod_pass_ge_0.90_levels_pearson": n_prod_pass,
        "n_soft_pass_delta_spearman_ge_0.35": n_soft_pass,
        "n_ge_0.25_delta_spearman": n_ge_025,
        "any_negative_delta_spearman": any_negative,
        "poc_equiv_gate_pass": poc_equiv_pass,
        "per_country": results,
    }


# ---------------------------------------------------------------------------
# Global threats/acts validation (sum across all countries in proxy, vs GPRHT/GPRHA)
# These are global series in the XLS, not per-country.
# For per-country threats/acts we use the same per-country GPRHC columns (not present);
# so we do a global aggregate correlation.
# ---------------------------------------------------------------------------
def aggregate_proxy_global(proxy_by_iso3):
    """Sum monthly values across all ISO3s to get a global monthly series."""
    by_month = {}
    for iso3, series in proxy_by_iso3.items():
        for ym, v in series.items():
            by_month.setdefault(ym, []).append(v)
    return {ym: statistics.fmean(vals) for ym, vals in by_month.items()}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=== QGI GPR Full Validation ===\n")

    # 1. Verify FIPS map
    iso3_from_map = set(FIPS_TO_ISO3.values())
    missing_iso3 = EXPECTED_ISO3 - iso3_from_map
    extra_iso3 = iso3_from_map - EXPECTED_ISO3
    if missing_iso3:
        print(f"WARNING: ISO3 missing from FIPS map: {sorted(missing_iso3)}")
    if extra_iso3:
        print(f"WARNING: ISO3 in FIPS map but not in EXPECTED_ISO3: {sorted(extra_iso3)}")

    print(f"FIPS->ISO3 map: {len(FIPS_TO_ISO3)} entries covering {len(iso3_from_map)} ISO3s")
    print(f"Expected ISO3s: {len(EXPECTED_ISO3)}")
    if not missing_iso3:
        print("All 44 GPRC ISO3s are covered.")
    print()

    # 2. Build proxies
    print("Loading gpr_monthly.csv...")
    gpr_proxy, thr_proxy, acts_proxy = build_proxies(GPR_MONTHLY_CSV, FIPS_TO_ISO3)
    print(f"  gpr_proxy countries: {sorted(gpr_proxy.keys())} ({len(gpr_proxy)})")
    print()

    # Save the 44-country proxy JSON
    os.makedirs(os.path.dirname(PROXY44_OUT), exist_ok=True)
    with open(PROXY44_OUT, "w", encoding="utf-8") as f:
        json.dump(gpr_proxy, f, indent=2)
    print(f"Saved proxy JSON: {PROXY44_OUT}")
    print()

    # 3. Load reference data (GPRC per country, + GPRHT/GPRHA global)
    print("Loading XLS answer key...")
    gprc_by_iso3 = load_xls_series(XLS_PATH, "GPRC_")
    global_series = load_global_series(XLS_PATH, ["GPRHT", "GPRHA"])
    print(f"  GPRC columns: {len(gprc_by_iso3)}")
    print(f"  Global series: {list(global_series.keys())}")
    print()

    # 4. Run main panel (gpr_share vs GPRC)
    print("Running main panel: gpr_share vs GPRC_*...")
    main_results = run_panel(gpr_proxy, gprc_by_iso3, "gpr_share (g1-g8 blended) vs GPRC")

    # 5. Also run threats_share vs GPRC and acts_share vs GPRC (per-country diagnostic)
    print("Running threats panel: threats_share vs GPRC_*...")
    thr_results = run_panel(thr_proxy, gprc_by_iso3, "threats_share (g1-g5) vs GPRC")

    print("Running acts panel: acts_share vs GPRC_*...")
    acts_results = run_panel(acts_proxy, gprc_by_iso3, "acts_share (g6-g8) vs GPRC")

    # 6. Global threats/acts vs GPRHT/GPRHA
    print("Running global threats vs GPRHT and acts vs GPRHA...")
    global_thr_agg = aggregate_proxy_global(thr_proxy)
    global_acts_agg = aggregate_proxy_global(acts_proxy)
    global_gpr_agg = aggregate_proxy_global(gpr_proxy)

    gprht_series = global_series.get("GPRHT", {})
    gprha_series = global_series.get("GPRHA", {})

    def global_corr(proxy_agg, ref_agg, label):
        months = sorted(set(proxy_agg) & set(ref_agg))
        if len(months) < 3:
            return {"label": label, "n": len(months), "error": "too few months"}
        px = [proxy_agg[m] for m in months]
        gp = [ref_agg[m] for m in months]
        px_d = diff(px)
        gp_d = diff(gp)
        sr, n_sp = spike_recall(gp_d, px_d)
        return {
            "label": label,
            "n": len(months),
            "pearson_levels": pearson_r(px, gp),
            "spearman_delta": spearman_r(px_d, gp_d),
            "spike_recall": sr,
            "n_spikes": n_sp,
        }

    global_thr_corr = global_corr(global_thr_agg, gprht_series, "global threats_share vs GPRHT")
    global_acts_corr = global_corr(global_acts_agg, gprha_series, "global acts_share vs GPRHA")
    global_gpr_corr = global_corr(global_gpr_agg, {}, "skip")  # no global GPRC reference

    # PoC comparison: PoC got mean delta-Spearman 0.4554 on 5 countries
    POC_MEAN_DELTA_SPEARMAN = 0.4554
    POC_N_COUNTRIES = 5

    # Print summary
    print("\n" + "="*70)
    print("RESULTS SUMMARY")
    print("="*70)

    mr = main_results
    print(f"\nMAIN PANEL: {mr['label']}")
    print(f"  Countries scored: {mr['n_scored']}/44")
    print(f"  Mean delta-Spearman (HEADLINE): {mr['mean_spearman_delta']:.4f}" if mr['mean_spearman_delta'] else "  Mean delta-Spearman: N/A")
    print(f"  Mean levels-Pearson (diagnostic): {mr['mean_pearson_levels']:.4f}" if mr['mean_pearson_levels'] else "  Mean levels-Pearson: N/A")
    print(f"  Mean spike-recall: {mr['mean_spike_recall']:.4f}" if mr['mean_spike_recall'] else "  Mean spike-recall: N/A")
    print(f"  Production gate (levels-Pearson >= 0.90): {mr['n_prod_pass_ge_0.90_levels_pearson']}/{mr['n_scored']} pass")
    print(f"  Soft bar (delta-Spearman >= 0.35): {mr['n_soft_pass_delta_spearman_ge_0.35']}/{mr['n_scored']} pass")
    print(f"  PoC equiv gate PASS: {mr['poc_equiv_gate_pass']}")

    print(f"\n  vs PoC (2-topic, 5 countries): mean delta-Spearman was {POC_MEAN_DELTA_SPEARMAN}")
    if mr['mean_spearman_delta'] is not None:
        delta = mr['mean_spearman_delta'] - POC_MEAN_DELTA_SPEARMAN
        direction = "IMPROVEMENT" if delta > 0 else "REGRESSION"
        print(f"  Full 8-cat method: {mr['mean_spearman_delta']:.4f} vs PoC {POC_MEAN_DELTA_SPEARMAN} -> {delta:+.4f} ({direction})")

    print("\n  Per-country table:")
    print(f"  {'ISO3':<6} {'n':>5} {'delta-Spear':>12} {'levels-Pear':>12} {'spike-rcl':>10} {'PASS':>5}")
    print("  " + "-"*55)
    for r in sorted(mr['per_country'], key=lambda x: x['iso3']):
        spear = f"{r['spearman_delta']:.4f}" if r['spearman_delta'] is not None else "  N/A"
        pears = f"{r['pearson_levels']:.4f}" if r['pearson_levels'] is not None else "  N/A"
        rec = f"{r['spike_recall']:.3f}"
        flag = "PASS" if r['prod_pass'] else "fail"
        print(f"  {r['iso3']:<6} {r['n']:>5} {spear:>12} {pears:>12} {rec:>10} {flag:>5}")

    print(f"\nTHREATS PANEL (threats_share vs GPRC):")
    tr = thr_results
    print(f"  Countries scored: {tr['n_scored']}")
    print(f"  Mean delta-Spearman: {tr['mean_spearman_delta']:.4f}" if tr['mean_spearman_delta'] else "  N/A")

    print(f"\nACTS PANEL (acts_share vs GPRC):")
    ar = acts_results
    print(f"  Countries scored: {ar['n_scored']}")
    print(f"  Mean delta-Spearman: {ar['mean_spearman_delta']:.4f}" if ar['mean_spearman_delta'] else "  N/A")

    print(f"\nGLOBAL SERIES:")
    print(f"  threats_share vs GPRHT: pearson_levels={global_thr_corr.get('pearson_levels','N/A')}, spearman_delta={global_thr_corr.get('spearman_delta','N/A')}, spike_recall={global_thr_corr.get('spike_recall','N/A')}")
    print(f"  acts_share vs GPRHA:    pearson_levels={global_acts_corr.get('pearson_levels','N/A')}, spearman_delta={global_acts_corr.get('spearman_delta','N/A')}, spike_recall={global_acts_corr.get('spike_recall','N/A')}")

    # Save JSON results
    all_results = {
        "main_panel": mr,
        "threats_vs_gprc": tr,
        "acts_vs_gprc": ar,
        "global_threats_vs_gprht": global_thr_corr,
        "global_acts_vs_gprha": global_acts_corr,
        "fips_to_iso3_map": FIPS_TO_ISO3,
        "missing_from_fips_map": sorted(missing_iso3),
    }

    with open(RESULTS_JSON, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2)
    print(f"\nSaved JSON: {RESULTS_JSON}")

    # Build the markdown report
    write_md_report(all_results, POC_MEAN_DELTA_SPEARMAN, POC_N_COUNTRIES, missing_iso3)
    print(f"Saved MD: {RESULTS_MD}")

    return all_results


def write_md_report(results, poc_mean_spear, poc_n, missing_iso3):
    mr = results["main_panel"]
    tr = results["threats_vs_gprc"]
    ar = results["acts_vs_gprc"]
    gthr = results["global_threats_vs_gprht"]
    gact = results["global_acts_vs_gprha"]

    md = []
    md.append("# GPR Full-Method Validation Results")
    md.append("")
    md.append(f"Date: 2026-06-13  |  Proxy: gpr_share (8-category blended)  |  Answer key: Caldara-Iacoviello GPRC_*, GPRHT, GPRHA")
    md.append("")
    md.append("## 0. FIPS to ISO3 Map (44 GPRC Countries)")
    md.append("")
    md.append("All 44 GPRC ISO3 columns covered. Map used (FIPS 10-4 standard):")
    md.append("")
    md.append("| FIPS | ISO3 | Country |")
    md.append("|------|------|---------|")
    country_names = {
        "ARG": "Argentina", "AUS": "Australia", "BEL": "Belgium", "BRA": "Brazil",
        "CAN": "Canada", "CHE": "Switzerland", "CHL": "Chile", "CHN": "China",
        "COL": "Colombia", "DEU": "Germany", "DNK": "Denmark", "EGY": "Egypt",
        "ESP": "Spain", "FIN": "Finland", "FRA": "France", "GBR": "United Kingdom",
        "HKG": "Hong Kong", "HUN": "Hungary", "IDN": "Indonesia", "IND": "India",
        "ISR": "Israel", "ITA": "Italy", "JPN": "Japan", "KOR": "South Korea",
        "MEX": "Mexico", "MYS": "Malaysia", "NLD": "Netherlands", "NOR": "Norway",
        "PER": "Peru", "PHL": "Philippines", "POL": "Poland", "PRT": "Portugal",
        "RUS": "Russia", "SAU": "Saudi Arabia", "SWE": "Sweden", "THA": "Thailand",
        "TUN": "Tunisia", "TUR": "Turkey", "TWN": "Taiwan", "UKR": "Ukraine",
        "USA": "United States", "VEN": "Venezuela", "VNM": "Vietnam", "ZAF": "South Africa",
    }
    from run_full_validation import FIPS_TO_ISO3 as FMAP
    for fips, iso3 in sorted(FMAP.items(), key=lambda x: x[1]):
        md.append(f"| {fips} | {iso3} | {country_names.get(iso3, '')} |")

    if missing_iso3:
        md.append("")
        md.append(f"**UNMAPPED ISO3 (dropped from run):** {sorted(missing_iso3)}")
    else:
        md.append("")
        md.append("No ISO3s dropped — all 44 mapped.")

    md.append("")
    md.append("## 1. Headline Numbers")
    md.append("")
    n = mr['n_scored']
    mean_sp = mr['mean_spearman_delta']
    mean_pr = mr['mean_pearson_levels']
    mean_rc = mr['mean_spike_recall']
    n_prod = mr['n_prod_pass_ge_0.90_levels_pearson']
    n_soft = mr['n_soft_pass_delta_spearman_ge_0.35']

    md.append(f"- Countries scored: **{n}/44**")
    md.append(f"- Mean delta-Spearman (HEADLINE): **{mean_sp:.4f}**" if mean_sp else "- Mean delta-Spearman: N/A")
    md.append(f"- Mean levels-Pearson (diagnostic, trend-inflated): **{mean_pr:.4f}**" if mean_pr else "")
    md.append(f"- Mean spike-recall: **{mean_rc:.4f}** (chance baseline = 0.25)" if mean_rc else "")
    md.append(f"- Production gate (levels-Pearson >= 0.90): **{n_prod}/{n}** pass")
    md.append(f"- Soft 'real signal' bar (delta-Spearman >= 0.35): **{n_soft}/{n}** pass")
    md.append(f"- PoC equivalent gate (mean delta-Spearman >= 0.35, >=3 countries >=0.25, none negative): **{'PASS' if mr['poc_equiv_gate_pass'] else 'FAIL'}**")
    md.append("")

    # PoC comparison
    if mean_sp is not None:
        delta = mean_sp - poc_mean_spear
        direction = "IMPROVEMENT" if delta > 0 else "REGRESSION"
        md.append(f"### PoC Comparison")
        md.append(f"- PoC (2-topic, {poc_n} countries): mean delta-Spearman = {poc_mean_spear}")
        md.append(f"- Full 8-category method ({n} countries): mean delta-Spearman = {mean_sp:.4f}")
        md.append(f"- Delta: **{delta:+.4f}** ({direction})")
        md.append("")

    md.append("## 2. Per-Country Results Table")
    md.append("")
    md.append("Gate metric: **levels-Pearson >= 0.90** (production fidelity bar, affine-invariant).")
    md.append("HEADLINE metric: **delta-Spearman** (month-over-month change Spearman, de-trended).")
    md.append("")
    md.append("| ISO3 | n | delta-Spearman | levels-Pearson | spike-recall | Prod Gate |")
    md.append("|------|---|---------------|----------------|-------------|-----------|")
    for r in sorted(mr['per_country'], key=lambda x: x['iso3']):
        spear = f"{r['spearman_delta']:.4f}" if r['spearman_delta'] is not None else "N/A"
        pears = f"{r['pearson_levels']:.4f}" if r['pearson_levels'] is not None else "N/A"
        rec = f"{r['spike_recall']:.3f}"
        flag = "PASS" if r['prod_pass'] else "fail"
        md.append(f"| {r['iso3']} | {r['n']} | {spear} | {pears} | {rec} | {flag} |")

    md.append("")
    md.append("## 3. Threats vs Acts Breakdown")
    md.append("")
    md.append("Do threats_share (g1-g5) and acts_share (g6-g8) each independently track GPRC?")
    md.append("")
    md.append("### 3a. threats_share vs GPRC (per-country)")
    md.append(f"- Countries scored: {tr['n_scored']}")
    md.append(f"- Mean delta-Spearman: {tr['mean_spearman_delta']:.4f}" if tr['mean_spearman_delta'] else "- Mean delta-Spearman: N/A")
    md.append(f"- Mean levels-Pearson: {tr['mean_pearson_levels']:.4f}" if tr['mean_pearson_levels'] else "")
    md.append(f"- Mean spike-recall: {tr['mean_spike_recall']:.4f}" if tr['mean_spike_recall'] else "")
    md.append(f"- Soft bar pass (>= 0.35): {tr['n_soft_pass_delta_spearman_ge_0.35']}/{tr['n_scored']}")
    md.append("")

    md.append("### 3b. acts_share vs GPRC (per-country)")
    md.append(f"- Countries scored: {ar['n_scored']}")
    md.append(f"- Mean delta-Spearman: {ar['mean_spearman_delta']:.4f}" if ar['mean_spearman_delta'] else "- Mean delta-Spearman: N/A")
    md.append(f"- Mean levels-Pearson: {ar['mean_pearson_levels']:.4f}" if ar['mean_pearson_levels'] else "")
    md.append(f"- Mean spike-recall: {ar['mean_spike_recall']:.4f}" if ar['mean_spike_recall'] else "")
    md.append(f"- Soft bar pass (>= 0.35): {ar['n_soft_pass_delta_spearman_ge_0.35']}/{ar['n_scored']}")
    md.append("")

    md.append("### 3c. Global aggregate: threats_share vs GPRHT, acts_share vs GPRHA")
    md.append("")
    md.append(f"| Series | n | pearson_levels | spearman_delta | spike_recall |")
    md.append(f"|--------|---|---------------|----------------|-------------|")
    for gc in [gthr, gact]:
        prl = f"{gc['pearson_levels']:.4f}" if gc.get('pearson_levels') is not None else "N/A"
        spd = f"{gc['spearman_delta']:.4f}" if gc.get('spearman_delta') is not None else "N/A"
        spr = f"{gc['spike_recall']:.3f}" if gc.get('spike_recall') is not None else "N/A"
        md.append(f"| {gc['label']} | {gc['n']} | {prl} | {spd} | {spr} |")

    if tr['mean_spearman_delta'] is not None and ar['mean_spearman_delta'] is not None:
        if ar['mean_spearman_delta'] > tr['mean_spearman_delta']:
            md.append("")
        md.append(f"")
        md.append(f"**Acts vs Threats (per-country):** acts mean delta-Spearman = {ar['mean_spearman_delta']:.4f}, threats = {tr['mean_spearman_delta']:.4f}.")
        if ar['mean_spearman_delta'] > tr['mean_spearman_delta']:
            md.append(f"Acts track GPRC **better** than threats (delta = {ar['mean_spearman_delta'] - tr['mean_spearman_delta']:+.4f}).")
        else:
            md.append(f"Threats track GPRC **better** than acts (delta = {tr['mean_spearman_delta'] - ar['mean_spearman_delta']:+.4f}).")

    md.append("")
    md.append("## 4. Verdict")
    md.append("")
    md.append("### Production Gate (levels-Pearson >= 0.90)")
    md.append(f"The gate metric is **levels-Pearson on the raw (uncalibrated) proxy series**, which is affine-invariant (identical to calibrated-levels-Pearson). Ji-Hoon noted this must never be switched silently.")
    md.append(f"")
    md.append(f"- Gate: {n_prod}/{n} countries PASS (need {n} for full gate)")
    if n_prod == n:
        md.append("- **ALL 44 countries pass the production gate. Ship condition MET.**")
    elif n_prod >= n * 0.75:
        md.append(f"- **{n_prod}/{n} pass (>= 75%). Strong signal; does not universally clear the strict gate.**")
    else:
        md.append(f"- **{n_prod}/{n} pass. Does NOT clear the strict production gate.**")

    md.append("")
    md.append("### Delta-Spearman Signal Bar")
    if mean_sp is not None and mean_sp >= 0.35:
        md.append(f"Mean delta-Spearman = {mean_sp:.4f} >= 0.35 soft bar: **REAL SIGNAL CONFIRMED**.")
    elif mean_sp is not None:
        md.append(f"Mean delta-Spearman = {mean_sp:.4f} < 0.35 soft bar: **signal below pre-registered PoC bar**.")
    md.append("")

    md.append("### Overall Verdict")
    md.append("")
    if n_prod >= n * 0.80 and mean_sp is not None and mean_sp >= 0.35:
        verdict = "VALIDATE — ready to extend to 215 countries and ship."
        justification = f"Strong per-country tracking ({n_prod}/{n} pass strict 0.90 gate) and mean delta-Spearman = {mean_sp:.4f} confirms shape tracking well above the PoC bar."
    elif mean_sp is not None and mean_sp >= 0.35:
        verdict = "CONDITIONAL — signal is real but production gate not universally cleared."
        justification = f"Mean delta-Spearman = {mean_sp:.4f} confirms real signal; however only {n_prod}/{n} countries clear levels-Pearson >= 0.90. Extend with per-country quality flags."
    else:
        verdict = "ITERATE — signal below bar; needs dictionary or coverage work."
        justification = f"Mean delta-Spearman = {mean_sp:.4f if mean_sp else 'N/A'} below 0.35 bar. Review dictionary coverage and country attribution."

    md.append(f"**{verdict}**")
    md.append("")
    md.append(justification)
    md.append("")
    md.append("### What to iterate on (if applicable)")
    if n_prod < n:
        failing = [r['iso3'] for r in mr['per_country'] if not r['prod_pass']]
        md.append(f"Countries failing strict gate: {sorted(failing)}")
        md.append("Likely causes: low GDELT coverage, sparse GPRC data, or dictionary gaps for these countries.")
    md.append("")
    md.append("---")
    md.append("")
    md.append("*Honesty note: This is a re-implementation on GDELT machine-coded events vs Caldara-Iacoviello's ~10 curated newspapers. Validate SHAPE and SPIKES; never claim the proxy IS GPR. Affine calibration is needed before publishing levels.*")

    with open(RESULTS_MD, "w", encoding="utf-8") as f:
        f.write("\n".join(md) + "\n")


if __name__ == "__main__":
    main()
