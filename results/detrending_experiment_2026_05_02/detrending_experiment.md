# Detrending Experiment — RAW vs FIRST-DIFF (#585) — 2026-05-02T16:02:33Z

**Method:** For each of the 29 I(1) indicators from #582 Phase 0c,
sample 2000 random (country_A, country_B, window_start) tuples
at segment lengths L ∈ [15, 25, 35]. Compute |Pearson r| under TWO methods:

- **RAW:** Z-score the level series within each window
- **DIFF:** First-difference each window, then Z-score the differences

This script does NOT pick a threshold — Tariq #20 + Miriam #19 pick from this data.

## Aggregate (mean across 29 indicators × 3 segment lengths = 87 combos)

- **Mean |r| under RAW:** 0.607
- **Mean |r| under DIFF:** 0.269
- **Mean fraction |r| ≥ 0.75 under RAW:** 42.1%
- **Mean fraction |r| ≥ 0.75 under DIFF:** 5.0%
- **Worst-case fraction |r| ≥ 0.75 under RAW:** 93.3%
- **Worst-case fraction |r| ≥ 0.75 under DIFF:** 23.3%

## Per-(indicator × segment-length) detail

| Indicator | L | RAW mean\|r\| | RAW p95 | RAW %>0.75 | DIFF mean\|r\| | DIFF p95 | DIFF %>0.75 | Δ%>0.75 |
|---|---|---|---|---|---|---|---|---|
| NY.GDP.MKTP.CD | 15 | 0.747 | 0.984 | 64.5% | 0.372 | 0.814 | 8.5% | **-56.1pp** |
| NY.GDP.MKTP.CD | 25 | 0.822 | 0.983 | 78.2% | 0.341 | 0.791 | 6.6% | **-71.6pp** |
| NY.GDP.MKTP.CD | 35 | 0.856 | 0.984 | 85.0% | 0.331 | 0.761 | 5.3% | **-79.7pp** |
| NY.GDP.MKTP.KD | 15 | 0.787 | 0.990 | 71.2% | 0.317 | 0.746 | 4.9% | **-66.3pp** |
| NY.GDP.MKTP.KD | 25 | 0.833 | 0.990 | 79.0% | 0.261 | 0.657 | 2.0% | **-77.0pp** |
| NY.GDP.MKTP.KD | 35 | 0.842 | 0.991 | 80.5% | 0.248 | 0.630 | 1.8% | **-78.7pp** |
| NY.GDP.PCAP.CD | 15 | 0.687 | 0.979 | 54.5% | 0.369 | 0.814 | 8.2% | **-46.3pp** |
| NY.GDP.PCAP.CD | 25 | 0.734 | 0.973 | 63.2% | 0.321 | 0.738 | 4.5% | **-58.7pp** |
| NY.GDP.PCAP.CD | 35 | 0.749 | 0.972 | 65.1% | 0.289 | 0.678 | 2.9% | **-62.2pp** |
| NY.GNP.PCAP.CD | 15 | 0.717 | 0.983 | 59.2% | 0.409 | 0.827 | 10.7% | **-48.5pp** |
| NY.GNP.PCAP.CD | 25 | 0.763 | 0.980 | 66.8% | 0.363 | 0.770 | 5.9% | **-60.9pp** |
| NY.GNP.PCAP.CD | 35 | 0.749 | 0.978 | 64.6% | 0.341 | 0.716 | 3.8% | **-60.8pp** |
| NE.EXP.GNFS.CD | 15 | 0.737 | 0.983 | 63.4% | 0.467 | 0.891 | 18.6% | **-44.8pp** |
| NE.EXP.GNFS.CD | 25 | 0.812 | 0.984 | 75.8% | 0.455 | 0.853 | 15.6% | **-60.2pp** |
| NE.EXP.GNFS.CD | 35 | 0.856 | 0.987 | 83.1% | 0.469 | 0.842 | 16.0% | **-67.1pp** |
| NE.IMP.GNFS.CD | 15 | 0.749 | 0.982 | 65.3% | 0.461 | 0.884 | 18.3% | **-47.0pp** |
| NE.IMP.GNFS.CD | 25 | 0.837 | 0.983 | 81.5% | 0.440 | 0.859 | 15.8% | **-65.8pp** |
| NE.IMP.GNFS.CD | 35 | 0.873 | 0.984 | 86.9% | 0.457 | 0.852 | 15.8% | **-71.0pp** |
| SP.POP.TOTL | 15 | 0.899 | 1.000 | 87.2% | 0.487 | 0.941 | 23.3% | **-63.9pp** |
| SP.POP.TOTL | 25 | 0.877 | 0.999 | 85.2% | 0.419 | 0.903 | 16.2% | **-69.0pp** |
| SP.POP.TOTL | 35 | 0.871 | 0.998 | 84.5% | 0.388 | 0.863 | 11.7% | **-72.8pp** |
| SP.DYN.TFRT.IN | 15 | 0.715 | 0.990 | 59.0% | 0.324 | 0.755 | 5.4% | **-53.6pp** |
| SP.DYN.TFRT.IN | 25 | 0.698 | 0.986 | 55.9% | 0.283 | 0.696 | 3.1% | **-52.8pp** |
| SP.DYN.TFRT.IN | 35 | 0.728 | 0.984 | 59.9% | 0.264 | 0.641 | 1.7% | **-58.1pp** |
| IT.CEL.SETS.P2 | 15 | 0.841 | 0.991 | 80.9% | 0.443 | 0.942 | 20.8% | **-60.1pp** |
| IT.CEL.SETS.P2 | 25 | 0.893 | 0.992 | 88.7% | 0.456 | 0.939 | 21.4% | **-67.2pp** |
| IT.CEL.SETS.P2 | 35 | 0.904 | 0.991 | 92.5% | 0.405 | 0.880 | 13.2% | **-79.2pp** |
| IT.NET.USER.ZS | 15 | 0.901 | 0.988 | 93.3% | 0.283 | 0.666 | 2.5% | **-90.9pp** |
| IT.NET.USER.ZS | 25 | 0.892 | 0.989 | 89.3% | 0.268 | 0.615 | 1.6% | **-87.8pp** |
| IT.NET.USER.ZS | 35 | 0.900 | 0.993 | 89.9% | 0.270 | 0.627 | 1.6% | **-88.4pp** |
| NV.IND.TOTL.ZS | 15 | 0.460 | 0.864 | 17.9% | 0.250 | 0.609 | 0.9% | **-17.0pp** |
| NV.IND.TOTL.ZS | 25 | 0.423 | 0.838 | 12.9% | 0.184 | 0.462 | 0.1% | **-12.8pp** |
| NV.IND.TOTL.ZS | 35 | 0.400 | 0.820 | 10.3% | 0.152 | 0.390 | 0.2% | **-10.2pp** |
| EN.GHG.CO2.PC.CE.AR5 | 15 | 0.501 | 0.911 | 25.8% | 0.238 | 0.571 | 1.1% | **-24.6pp** |
| EN.GHG.CO2.PC.CE.AR5 | 25 | 0.515 | 0.918 | 25.2% | 0.180 | 0.451 | 0.1% | **-25.1pp** |
| EN.GHG.CO2.PC.CE.AR5 | 35 | 0.503 | 0.913 | 24.1% | 0.154 | 0.391 | 0.5% | **-23.6pp** |
| EG.IMP.CONS.ZS | 15 | 0.461 | 0.875 | 17.2% | 0.226 | 0.542 | 0.2% | **-16.9pp** |
| EG.IMP.CONS.ZS | 25 | 0.447 | 0.867 | 17.1% | 0.170 | 0.421 | 0.0% | **-17.1pp** |
| SL.EMP.TOTL.SP.ZS | 15 | 0.508 | 0.924 | 25.1% | 0.305 | 0.715 | 3.8% | **-21.3pp** |
| SL.EMP.TOTL.SP.ZS | 25 | 0.458 | 0.897 | 19.7% | 0.249 | 0.649 | 2.0% | **-17.7pp** |
| SL.TLF.CACT.FE.ZS | 15 | 0.601 | 0.968 | 40.8% | 0.294 | 0.733 | 4.5% | **-36.2pp** |
| SL.TLF.CACT.FE.ZS | 25 | 0.551 | 0.958 | 32.2% | 0.245 | 0.664 | 2.1% | **-30.1pp** |
| SL.TLF.CACT.FE.ZS | 35 | 0.519 | 0.941 | 30.3% | 0.219 | 0.601 | 1.6% | **-28.8pp** |
| SL.UEM.1524.ZS | 15 | 0.458 | 0.885 | 16.8% | 0.274 | 0.676 | 2.7% | **-14.1pp** |
| SL.UEM.1524.ZS | 25 | 0.406 | 0.827 | 10.7% | 0.223 | 0.570 | 1.6% | **-9.1pp** |
| SL.UEM.TOTL.ZS | 15 | 0.431 | 0.864 | 14.4% | 0.272 | 0.671 | 2.4% | **-12.0pp** |
| SL.UEM.TOTL.ZS | 25 | 0.391 | 0.812 | 9.2% | 0.224 | 0.607 | 1.6% | **-7.5pp** |
| SE.PRM.ENRR | 15 | 0.482 | 0.920 | 22.7% | 0.249 | 0.597 | 0.9% | **-21.8pp** |
| SE.PRM.ENRR | 25 | 0.463 | 0.871 | 16.8% | 0.176 | 0.419 | 0.3% | **-16.5pp** |
| SE.PRM.ENRR | 35 | 0.453 | 0.925 | 21.6% | 0.161 | 0.387 | 0.0% | **-21.6pp** |
| FI.RES.TOTL.CD | 15 | 0.600 | 0.955 | 39.1% | 0.288 | 0.688 | 2.4% | **-36.8pp** |
| FI.RES.TOTL.CD | 25 | 0.660 | 0.957 | 49.4% | 0.247 | 0.611 | 1.1% | **-48.2pp** |
| FI.RES.TOTL.CD | 35 | 0.705 | 0.957 | 59.4% | 0.229 | 0.551 | 0.6% | **-58.8pp** |
| FM.LBL.BMNY.GD.ZS | 15 | 0.494 | 0.915 | 23.5% | 0.252 | 0.614 | 1.4% | **-22.1pp** |
| FM.LBL.BMNY.GD.ZS | 25 | 0.489 | 0.906 | 20.8% | 0.192 | 0.487 | 0.1% | **-20.6pp** |
| FM.LBL.BMNY.GD.ZS | 35 | 0.463 | 0.884 | 17.1% | 0.164 | 0.418 | 0.2% | **-16.9pp** |
| FB.AST.NPER.ZS | 15 | 0.445 | 0.906 | 19.1% | 0.289 | 0.724 | 4.6% | **-14.5pp** |
| CC.EST | 15 | 0.422 | 0.834 | 12.0% | 0.249 | 0.583 | 0.5% | **-11.5pp** |
| RQ.EST | 15 | 0.428 | 0.841 | 12.2% | 0.254 | 0.597 | 1.0% | **-11.2pp** |
| v2cacamps | 15 | 0.457 | 0.919 | 18.2% | 0.240 | 0.821 | 6.8% | **-11.5pp** |
| v2cacamps | 25 | 0.431 | 0.887 | 15.5% | 0.178 | 0.627 | 2.3% | **-13.2pp** |
| v2cacamps | 35 | 0.423 | 0.870 | 14.0% | 0.151 | 0.560 | 1.6% | **-12.4pp** |
| v2excrptps | 15 | 0.496 | 0.934 | 20.9% | 0.201 | 0.815 | 6.4% | **-14.4pp** |
| v2excrptps | 25 | 0.472 | 0.913 | 19.2% | 0.146 | 0.684 | 3.8% | **-15.4pp** |
| v2excrptps | 35 | 0.479 | 0.903 | 20.2% | 0.115 | 0.563 | 2.1% | **-18.0pp** |
| v2exl_legitlead | 15 | 0.479 | 0.934 | 19.4% | 0.202 | 0.824 | 6.6% | **-12.8pp** |
| v2exl_legitlead | 25 | 0.441 | 0.904 | 16.1% | 0.162 | 0.719 | 4.3% | **-11.8pp** |
| v2exl_legitlead | 35 | 0.432 | 0.877 | 14.5% | 0.126 | 0.545 | 2.1% | **-12.4pp** |
| v2x_corr | 15 | 0.488 | 0.918 | 21.1% | 0.218 | 0.747 | 5.0% | **-16.1pp** |
| v2x_corr | 25 | 0.463 | 0.894 | 18.1% | 0.151 | 0.561 | 2.5% | **-15.6pp** |
| v2x_corr | 35 | 0.460 | 0.892 | 18.4% | 0.126 | 0.509 | 1.5% | **-16.9pp** |
| v2x_neopat | 15 | 0.474 | 0.905 | 18.5% | 0.221 | 0.692 | 3.9% | **-14.6pp** |
| v2x_neopat | 25 | 0.452 | 0.875 | 15.8% | 0.164 | 0.548 | 1.6% | **-14.2pp** |
| v2x_neopat | 35 | 0.457 | 0.877 | 16.4% | 0.136 | 0.470 | 1.2% | **-15.2pp** |
| v2x_rule | 15 | 0.496 | 0.929 | 22.5% | 0.239 | 0.770 | 5.6% | **-16.9pp** |
| v2x_rule | 25 | 0.473 | 0.892 | 18.8% | 0.161 | 0.594 | 2.1% | **-16.7pp** |
| v2x_rule | 35 | 0.468 | 0.891 | 18.8% | 0.138 | 0.515 | 1.6% | **-17.1pp** |

## Empirical correlation distribution under DIFF, by threshold

Aggregate fraction of random pairs with |r| above each threshold,
after first-differencing. This is the curve Tariq + Miriam should use to pick the I(1)-regime threshold.

| Threshold | RAW mean fraction | DIFF mean fraction |
|---|---|---|
| 0.5 | 63.5% | **17.3%** |
| 0.6 | 55.5% | **11.3%** |
| 0.7 | 46.9% | **6.8%** |
| 0.75 | 42.1% | **5.0%** |
| 0.8 | 36.9% | **3.6%** |
| 0.9 | 23.6% | **1.3%** |

## Interpretation guide for the methodology council

Tariq #20 + Miriam #19 must select a threshold for the I(1) (first-differenced)
regime that:
- (a) keeps the spurious-pass-through rate acceptably low — say ≤5%
- (b) does not over-filter genuine signal (which the auditioner lift comparison will measure)

The DIFF columns above show the random-pair distribution after detrending.
Compare to the RAW columns to see how much the detrending shifts the distribution.

Companion data needed before the council adjudicates:
- Lift values from auditioner under raw and diff (separate experiment)
- Genuine-signal retention test (selected country pairs known to share genuine relationships)