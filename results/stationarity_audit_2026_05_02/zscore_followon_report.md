# SCDI Z-score + 0.75 Filter Empirical Test — 2026-05-02T14:41:03Z

**Question:** Does QGI's within-segment Z-scoring + the M2=0.75 SCDI cut
effectively filter out spurious correlations from confirmed I(1) indicators?

**Method:** For each I(1) indicator, sample 2000 random
(country_A, country_B, window_start) tuples with segment lengths L ∈ [15, 25, 35].
Z-score each window. Compute |Pearson r|. Report fraction with |r| ≥ 0.75.

## Aggregate verdict

- **Overall worst fraction above 0.75:** 92.2%
- **Overall mean fraction above 0.75:** 62.9%
- **Indicators where M2 filters effectively (<10%):** 1
- **Indicators with partial filtering (10-30%):** 2
- **Indicators where M2 does NOT filter (≥30%):** 8
- **Verdict:** **M2_DOES_NOT_FILTER**
- **Action:** Z-scoring + 0.75 cut do NOT effectively filter spurious I(1) correlations. #585 detrending engineering required for confirmed I(1) indicators.

## Per-indicator verdicts (worst-case across L=15/25/35)

| Indicator | Worst %>0.75 | Verdict |
|---|---|---|
| Mobile subscriptions /100 | 92.2% | **M2_DOES_NOT_FILTER** |
| Population, total | 87.7% | **M2_DOES_NOT_FILTER** |
| Imports | 86.5% | **M2_DOES_NOT_FILTER** |
| GDP (current USD) | 84.8% | **M2_DOES_NOT_FILTER** |
| Exports | 83.5% | **M2_DOES_NOT_FILTER** |
| GDP (constant USD) | 81.8% | **M2_DOES_NOT_FILTER** |
| GNI per capita | 65.8% | **M2_DOES_NOT_FILTER** |
| GDP per capita | 64.3% | **M2_DOES_NOT_FILTER** |
| V-Dem control of corruption | 20.5% | **PARTIAL** |
| Unemployment % | 14.8% | **PARTIAL** |
| Tax revenue %GDP | 9.4% | **M2_FILTERS_EFFECTIVELY** |

## Detail — per (indicator, segment length)

| Indicator | L | n | mean\|r\| | median\|r\| | p95\|r\| | %>0.5 | %>0.75 | %>0.9 |
|---|---|---|---|---|---|---|---|---|
| Population, total | 15 | 2000 | 0.898 | 0.980 | 1.000 | 93.0% | **87.7%** | 77.6% |
| Population, total | 25 | 2000 | 0.880 | 0.973 | 0.999 | 92.2% | **85.2%** | 73.2% |
| Population, total | 35 | 2000 | 0.867 | 0.960 | 0.998 | 92.2% | **82.9%** | 67.8% |
| GDP per capita | 15 | 2000 | 0.681 | 0.779 | 0.980 | 74.4% | **53.9%** | 29.5% |
| GDP per capita | 25 | 2000 | 0.737 | 0.838 | 0.974 | 81.7% | **63.7%** | 33.9% |
| GDP per capita | 35 | 2000 | 0.753 | 0.843 | 0.970 | 85.2% | **64.3%** | 34.5% |
| GDP (constant USD) | 15 | 2000 | 0.795 | 0.903 | 0.991 | 86.2% | **72.2%** | 51.0% |
| GDP (constant USD) | 25 | 2000 | 0.822 | 0.918 | 0.991 | 88.8% | **78.5%** | 56.0% |
| GDP (constant USD) | 35 | 2000 | 0.851 | 0.926 | 0.991 | 92.8% | **81.8%** | 59.2% |
| GDP (current USD) | 15 | 2000 | 0.740 | 0.840 | 0.985 | 81.5% | **62.6%** | 39.0% |
| GDP (current USD) | 25 | 2000 | 0.823 | 0.901 | 0.981 | 91.5% | **78.8%** | 50.2% |
| GDP (current USD) | 35 | 2000 | 0.855 | 0.913 | 0.983 | 95.0% | **84.8%** | 56.6% |
| GNI per capita | 15 | 2000 | 0.716 | 0.821 | 0.985 | 78.0% | **59.5%** | 34.5% |
| GNI per capita | 25 | 2000 | 0.749 | 0.851 | 0.978 | 82.8% | **65.8%** | 38.6% |
| GNI per capita | 35 | 2000 | 0.754 | 0.844 | 0.975 | 84.7% | **65.5%** | 35.8% |
| Mobile subscriptions /100 | 15 | 2000 | 0.832 | 0.904 | 0.990 | 92.0% | **79.8%** | 51.4% |
| Mobile subscriptions /100 | 25 | 2000 | 0.894 | 0.927 | 0.992 | 99.6% | **89.2%** | 61.4% |
| Mobile subscriptions /100 | 35 | 2000 | 0.905 | 0.937 | 0.992 | 99.7% | **92.2%** | 65.6% |
| V-Dem control of corruption | 15 | 2000 | 0.483 | 0.483 | 0.922 | 47.9% | **20.5%** | 6.7% |
| V-Dem control of corruption | 25 | 2000 | 0.472 | 0.468 | 0.898 | 46.4% | **19.5%** | 5.0% |
| V-Dem control of corruption | 35 | 2000 | 0.457 | 0.449 | 0.891 | 44.7% | **17.1%** | 4.3% |
| Exports | 15 | 2000 | 0.741 | 0.859 | 0.984 | 80.6% | **64.4%** | 41.1% |
| Exports | 25 | 2000 | 0.814 | 0.904 | 0.984 | 89.9% | **76.1%** | 51.3% |
| Exports | 35 | 2000 | 0.859 | 0.924 | 0.987 | 94.2% | **83.5%** | 59.2% |
| Imports | 15 | 2000 | 0.744 | 0.858 | 0.982 | 81.4% | **64.1%** | 39.4% |
| Imports | 25 | 2000 | 0.827 | 0.906 | 0.982 | 91.3% | **80.3%** | 52.1% |
| Imports | 35 | 2000 | 0.872 | 0.927 | 0.986 | 95.5% | **86.5%** | 60.2% |
| Unemployment % | 15 | 2000 | 0.430 | 0.416 | 0.870 | 40.2% | **14.8%** | 3.3% |
| Unemployment % | 25 | 2000 | 0.399 | 0.384 | 0.824 | 35.1% | **10.5%** | 1.3% |
| Tax revenue %GDP | 15 | 1483 | 0.389 | 0.378 | 0.803 | 33.6% | **9.4%** | 0.5% |
| Tax revenue %GDP | 25 | 745 | 0.366 | 0.348 | 0.745 | 30.6% | **4.7%** | 0.1% |
| Tax revenue %GDP | 35 | 414 | 0.357 | 0.346 | 0.737 | 30.9% | **3.6%** | 0.5% |

## Interpretation

If the M2=0.75 SCDI cut filters spurious correlations from I(1) indicators
effectively, the fraction of random country-pair × random-window samples
with |r| ≥ 0.75 should be small. If it is large, then random walks correlated
by virtue of shared integration order routinely pass the 0.75 cut, contaminating
the lift values used by #577.

This is a direct empirical answer to the founder's question: *does the 0.75 cut
save us from the unit-root problem?* It bypasses theoretical debate (Roshani vs.
Tariq on Z-scoring's effect on integrated series) and measures the actual
filtering rate on QGI's actual data.