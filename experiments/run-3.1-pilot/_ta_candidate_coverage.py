import sys, json
from pathlib import Path
sys.path.insert(0,'scripts'); sys.path.insert(0,'experiments/run-3.1-pilot')
import run_f_ml_1_poc as w
import stability_select as ss
import pandas as pd

POSITIVES_CSV = Path('data/shape_inputs_v2/terrorist_attack/positives.csv')
pos = ss._load_positives(POSITIVES_CSV)  # columns: country, year, label
n_pos = len(pos)

CANDIDATES = [
    "NY.GDP.PCAP.CD",       # GDP per capita
    "OWID_POP_YOUNG",       # youth bulge (OWID)
    "SP.POP.0014.TO.ZS",    # pop 0-14 share (youth bulge alt)
    "v2pepwrses",           # power dist by socioeconomic position (ethnic-exclusion adjacent)
    "v2pepwrsoc",           # power dist by social group (EPR-style ethnic exclusion)
    "GE.EST",               # WGI govt effectiveness (state weakness/fragility)
    "RQ.EST",               # WGI regulatory quality
    "CC.EST",               # WGI control of corruption
    "RL.EST",               # WGI rule of law
    "PV.EST",               # WGI political stability/absence of violence-TERRORISM (leakage risk!)
    "OWID_STATECAP",        # state capacity index
    "UCDP_SB_CONFLICT_COUNT",
    "UCDP_YEARS_SINCE_LAST_CONFLICT",
    "UCDP_GED_TOTAL_DEATHS",
    "UCDP_SB_ONSET",
    "SI.POV.GINI",          # grievance/inequality
    "v2xeg_eqprotec",       # equal protection (grievance/governance)
    "v2exl_legitlead",      # leadership legitimacy (already flagged confound elsewhere)
    "v2svstterr",           # state territorial authority (fragility, rater-hindsight risk)
    "OWID_AUTOCRATIZATION", # KNOWN confound (episode-coded) - included for contrast
]

def panel_lookup(panel, country, year):
    col = [c for c in panel.columns if c not in ('country','year')][0]
    row = panel[(panel['country']==country) & (panel['year']==year)]
    if len(row)==0:
        return None
    v = row.iloc[0][col]
    return None if pd.isna(v) else v

results = []
for ind in CANDIDATES:
    try:
        panel = w.load_panel(ind, Path('data/parquet_panels'))
    except Exception as e:
        results.append({"indicator": ind, "error": str(e)})
        continue
    col = [c for c in panel.columns if c not in ('country','year')][0]
    nn = panel[panel[col].notna()]
    yr_min, yr_max = int(nn['year'].min()), int(nn['year'].max())
    n_ctry = nn['country'].nunique()
    ok_t1t2 = 0
    for _, r in pos.iterrows():
        country, year = r['country'], int(r['year'])
        v1 = panel_lookup(panel, country, year-1)
        v2 = panel_lookup(panel, country, year-2)
        if v1 is not None and v2 is not None:
            ok_t1t2 += 1
    results.append({
        "indicator": ind,
        "depth_years": f"{yr_min}-{yr_max}",
        "n_countries_nonnull": int(n_ctry),
        "coverage_at_pos_t1_t2": round(ok_t1t2/n_pos, 4),
        "n_pos_covered": ok_t1t2,
        "n_pos_total": n_pos,
    })
    print(json.dumps(results[-1]))

Path('experiments/run-3.1-pilot/results/terrorist_attack.candidate_coverage.json').write_text(
    json.dumps(results, indent=2), encoding='utf-8')
