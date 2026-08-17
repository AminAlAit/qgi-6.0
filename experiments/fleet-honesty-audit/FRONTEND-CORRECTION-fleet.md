# Frontend handoff → fleet-wide live-number correction (honesty audit, 2026-07-12)

**From:** ML/R&D session. Re-measured every live run-2 recipe with the exact honest method that produced banking's 0.638 and military_coup's 0.652 (both reproduced to the decimal — method validated). Shipped numbers cherry-picked a lucky greedy window; the honest re-measurement (`_final_fit`, re-argmax window over WINDOW_GRID, current representative event set, seed 12345) is the defensible value.

**34 live recipes need their number brought down.** Each was verified: its shipped AUC is **unreachable at ANY window** on current data (not a measurement artifact — 8 other live recipes reproduce cleanly), and all recipe panels loaded with real data.

⚠️ **Operational constraint (same as the banking handoff):** each card is a checksum-verified baked artifact — a raw JSON edit fails the build unless `data/build-manifest.json`'s sha256 for that card is also bumped, OR (clean path) the cards are re-baked at source with these values. 34 cards → **re-bake at source is strongly preferred** over 34 manual sha bumps.

## Corrections (worst first)

| Trend | Shipped | → Honest | 95% band | Δ | Note |
|---|---|---|---|---|---|
| monetary_policy_change | 0.783 | **0.617** | [0.5305, 0.6972] | -0.166 | ⚠️fragile (sd 0.0432) |
| executive_power_consolidation | 0.782 | **0.633** | [0.5525, 0.7095] | -0.149 |  |
| religious_and_social_movement | 0.819 | **0.675** | [0.5674, 0.7718] | -0.143 | ⚠️fragile (sd 0.0393) |
| banking_and_financial_crisis | 0.771 | **0.638** | [0.5612, 0.6985] | -0.133 |  |
| agricultural_policy | 0.736 | **0.610** | [0.5363, 0.6738] | -0.126 |  |
| labor_action | 0.815 | **0.689** | [0.5873, 0.7776] | -0.126 | ⚠️fragile (sd 0.0315) |
| economic_growth_milestone | 0.737 | **0.618** | [0.5248, 0.7059] | -0.119 |  |
| economic_liberalization | 0.692 | **0.578** | [0.4986, 0.6574] | -0.114 |  |
| currency_crisis | 0.857 | **0.755** | [0.6735, 0.8239] | -0.103 | ⚠️fragile (sd 0.0352) |
| ethnic_and_communal_conflict | 0.699 | **0.606** | [0.5261, 0.682] | -0.092 |  |
| trade_agreement | 0.711 | **0.624** | [0.5487, 0.6932] | -0.087 | ⚠️fragile (sd 0.0319) |
| economic_nationalization | 0.781 | **0.695** | [0.6095, 0.7687] | -0.086 | ⚠️fragile (sd 0.0375) |
| technology_breakthrough | 0.773 | **0.689** | [0.622, 0.7543] | -0.084 |  |
| political_violence | 0.630 | **0.548** | [0.5067, 0.5921] | -0.082 |  |
| diplomatic_rupture | 0.733 | **0.655** | [0.5857, 0.725] | -0.078 |  |
| fiscal_policy_change | 0.662 | **0.593** | [0.5344, 0.6468] | -0.069 |  |
| territorial_disputes | 0.707 | **0.638** | [0.5715, 0.6964] | -0.068 |  |
| economic_recession | 0.661 | **0.593** | [0.5433, 0.6433] | -0.068 |  |
| regional_integration | 0.722 | **0.658** | [0.5985, 0.7088] | -0.064 |  |
| sanctions_and_arms_embargo | 0.807 | **0.744** | [0.6656, 0.8112] | -0.063 |  |
| migration_and_refugees | 0.616 | **0.554** | [0.5053, 0.6046] | -0.062 |  |
| political_corruption | 0.681 | **0.627** | [0.5783, 0.674] | -0.054 | minor |
| terrorist_attack | 0.628 | **0.575** | [0.535, 0.6186] | -0.053 | minor |
| military_policy_and_reform | 0.672 | **0.622** | [0.5725, 0.6704] | -0.051 | minor |
| foreign_intervention | 0.723 | **0.676** | [0.6173, 0.732] | -0.046 | minor |
| mass_protest | 0.655 | **0.611** | [0.5684, 0.6512] | -0.044 | minor |
| democratic_transition | 0.697 | **0.654** | [0.6113, 0.6955] | -0.043 | minor |
| human_rights_reform | 0.631 | **0.592** | [0.5292, 0.6527] | -0.039 | minor |
| energy_policy | 0.678 | **0.639** | [0.5702, 0.6984] | -0.039 | ⚠️fragile (sd 0.0308), minor |
| civil_war_and_insurgency | 0.688 | **0.651** | [0.6133, 0.6847] | -0.037 | minor |
| peacekeeping_and_peace_process | 0.675 | **0.639** | [0.5876, 0.6861] | -0.036 | minor |
| military_coup | 0.686 | **0.652** | [0.598, 0.7011] | -0.034 | minor |
| infrastructure_project | 0.684 | **0.653** | [0.5609, 0.7327] | -0.031 | ⚠️fragile (sd 0.03), minor |
| government_formation | 0.579 | **0.549** | [0.517, 0.5823] | -0.030 | minor |

## Per-card fields to set
For each trend, in `data/te-fleet-run-2/cards-v3/<trend>.card.json`:
- `stats.loco_auc` → honest · `stats.ci95_lo/ci95_hi` → honest 95% band · `stats.ci80_lo/ci80_hi` → honest 80% band · `greedy_walk.final_global_auc` → honest
- Renders that self-update: `/trends` tiles, detail Discrimination + band, trend-tracker blog tile (all read `stats.loco_auc`).

## Wording (global, all trends)
- Soften "driving this trend" → "associated with" (correlational honesty; carries from banking).
- Fragile trends (⚠️) — widen bands / add a stability caveat; their honest number swings with the random negative draw.