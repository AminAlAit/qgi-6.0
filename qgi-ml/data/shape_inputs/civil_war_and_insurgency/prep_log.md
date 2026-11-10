# Shape Input Panel — Prep Log

**Recipe:** `civil_war_and_insurgency`  
**Canonical length T_r:** 5  
**Prepared:** 2026-05-17T21:18:50.530030+00:00  
**Commit:** `b36048291d7299bd585de5730ada34e921b0b178`  

## Instance counts

| Stage | Count |
|-------|-------|
| n_pos_input (curated events, training window 1789-2021) | 574 |
| Country not in local panel | -2 |
| BASELINE_TOO_SHORT (§3.2.2) | -532 |
| After baseline filter | 40 |
| Alignment dropouts | -0 |
| **Final instances in parquet** | **40** |

## Indicator coverage

**3/10** (30%) key indicators available in local panel snapshot.

**Available:** ['EG.IMP.CONS.ZS', 'SL.UEM.TOTL.ZS', 'v2cacamps']

**Missing (BLOCKED — not in local 37-indicator snapshot):**
['MS.MIL.MPRT.KD', 'NE.CON.GOVT.ZS', 'PV.EST', 'SM.POP.NETM', 'VA.EST', 'VC.BTL.DETH', 'v2exremhog']

> **Honesty disclosure:** G3/G4 substrate verdicts are BLOCKED-on-substrate-availability. Re-run on full 104-indicator production panel required (substrate-audit-phase-1.json P0 actions).

## Dropout sample (first 10)

| country_id | event_year | reason |
|------------|-----------|--------|
| afghanistan | 1974 | BASELINE_TOO_SHORT:EG.IMP.CONS.ZS (country not in panel) |
| afghanistan | 1975 | BASELINE_TOO_SHORT:EG.IMP.CONS.ZS (country not in panel) |
| afghanistan | 1978 | BASELINE_TOO_SHORT:EG.IMP.CONS.ZS (country not in panel) |
| afghanistan | 1979 | BASELINE_TOO_SHORT:EG.IMP.CONS.ZS (country not in panel) |
| afghanistan | 1980 | BASELINE_TOO_SHORT:EG.IMP.CONS.ZS (country not in panel) |
| afghanistan | 1981 | BASELINE_TOO_SHORT:EG.IMP.CONS.ZS (country not in panel) |
| afghanistan | 1983 | BASELINE_TOO_SHORT:EG.IMP.CONS.ZS (country not in panel) |
| afghanistan | 1989 | BASELINE_TOO_SHORT:EG.IMP.CONS.ZS (country not in panel) |
| afghanistan | 1992 | BASELINE_TOO_SHORT:EG.IMP.CONS.ZS (country not in panel) |
| afghanistan | 1993 | BASELINE_TOO_SHORT:EG.IMP.CONS.ZS (country not in panel) |

## Output files

| File | Description |
|------|-------------|
| `positives_aligned.parquet` | Long-format aligned+normalized trajectories |
| `positives.csv` | Positives CSV for fitter `--positive-instances` |
| `indicator_panel.parquet` | Indicator panel for fitter `--indicator-panel` |
| `prep_manifest.json` | Full provenance manifest |

## Fitter invocation (Chunk C.2)

```bash
python scripts/fit_shape_prototype.py \
    --recipe civil_war_and_insurgency \
    --indicator-panel data\shape_inputs\civil_war_and_insurgency\indicator_panel.parquet \
    --positive-instances data\shape_inputs\civil_war_and_insurgency\positives.csv \
    --indicator-ids EG.IMP.CONS.ZS,SL.UEM.TOTL.ZS,v2cacamps \
    --T-r 5
```