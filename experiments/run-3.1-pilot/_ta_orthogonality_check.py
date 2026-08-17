import sys
from pathlib import Path
sys.path.insert(0,'scripts')
import run_f_ml_1_poc as w
import pandas as pd

RUN2 = ["VC.BTL.DETH","VC.IDP.NWDS","DT.TDS.DECT.EX.ZS","MS.MIL.XPND.GD.ZS","v2xel_frefair","SL.UEM.1524.ZS"]
CANDS = ["OWID_POP_YOUNG","v2pepwrsoc","v2pepwrses","NY.GDP.PCAP.CD","OWID_STATECAP","v2svstterr","UCDP_SB_ONSET"]

def load(ind):
    p = w.load_panel(ind, Path('data/parquet_panels'))
    col = [c for c in p.columns if c not in ('country','year')][0]
    return p[['country','year',col]].rename(columns={col:ind})

frames = {ind: load(ind) for ind in RUN2+CANDS}
merged = None
for ind, df in frames.items():
    merged = df if merged is None else merged.merge(df, on=['country','year'], how='outer')

for c in CANDS:
    print(f"\n== {c} vs run-2 drivers (pairwise Pearson r, overlapping rows) ==")
    for r2 in RUN2:
        sub = merged[[c, r2]].dropna()
        if len(sub) < 30:
            print(f"  {r2:20s} n={len(sub):5d}  r=  n/a (too few overlapping rows)")
            continue
        r = sub[c].corr(sub[r2])
        print(f"  {r2:20s} n={len(sub):5d}  r={r:+.3f}")
