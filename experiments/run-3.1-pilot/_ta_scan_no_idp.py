import sys, json
from pathlib import Path
sys.path.insert(0,'scripts'); sys.path.insert(0,'experiments/run-3.1-pilot')
import run_f_ml_1_poc as w
import stability_select as ss
SEED=12345
DRIVERS=["VC.BTL.DETH","DT.TDS.DECT.EX.ZS","MS.MIL.XPND.GD.ZS","v2xel_frefair","SL.UEM.1524.ZS"]
pos = ss._load_positives(Path('data/shape_inputs_v2/terrorist_attack/positives.csv'))
samples = w.build_samples(pos, negatives_per_positive=ss.NEGATIVES_PER_POSITIVE, seed=SEED)
panels = {ind: w.load_panel(ind, Path('data/parquet_panels')) for ind in DRIVERS}
rows=[]
for win in w.WINDOW_GRID:
    X,y,c,yr = w.build_X_y(samples, DRIVERS, win, panels)
    cov = w.coverage_report(samples, DRIVERS, win, panels)
    gate = w.coverage_gate_ok(cov)
    entry={"window":win,"coverage_pass":bool(gate),**cov}
    if len(X)>=30 and len(set(y.tolist()))>1:
        res = w.fit_predict_loco(X,y,c,yr,architecture="XGBoost",seed=SEED)
        entry["global_auc"]=float(res["global_auc"])
    else:
        entry["global_auc"]=None
    rows.append(entry)
    print(json.dumps(entry))
gated=[r for r in rows if r["coverage_pass"] and r["global_auc"] is not None]
if gated:
    best=max(gated,key=lambda r:r["global_auc"])
    print("\n[HONEST coverage-gated argmax, no IDP]"); print(json.dumps(best,indent=2))
else:
    print("\nNONE pass gate")
