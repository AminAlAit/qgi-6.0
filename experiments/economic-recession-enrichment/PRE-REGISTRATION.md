# economic_recession enrichment — PRE-REGISTRATION 🔒 (2026-07-11)

Method: qgi-docs/internal/rnd/recipe-enrichment-methodology-and-banking-case.md. Fixed before build+test; no relaxation. Purist AMBER→buildable with the 3 hardenings below (baked in).

## Context (P0, verified)
- Step 0 fixed via events top-up: 250 events / 106 countries (US/France/Italy/Canada added; GFC=2008 corpus-consistent).
- **Honest baseline = 0.547** (run-2 drivers `v2csreprss`, `v2x_freexp_altinf`; recomputed on 250-event set, XGBoost, window 3; CI [0.507, 0.589]) — **near chance.** Governance drivers barely predict recessions. **No live LOCK exists** (recession was HARD_FAIL) → no frontend number at risk.
- Architecture: XGBoost (n_pos 250 ≥ 60).
- ⚠️ Substrate gap: no yield-curve/term-spread, house-price, or confidence series in the panel — the strongest EWS mechanisms are absent.

## Candidates (favor MEASURED LEADING macro)
1. `FD.AST.PRVT.GD.ZS` — private-credit/GDP (level + 3y-acceleration). 82% cov. Lead-consistent (flat decay). ⚠️ weakest orthogonality (|r|~0.36 vs run-2).
2. `FM.LBL.BMNY.GD.ZS` — M2/GDP (level + 3y-decel). 74% cov. Orthogonal. Direction inconclusive.
3. `NE.GDI.TOTL.ZS` — investment. ⚠️ **already a charter shape-prototype indicator for recession** — an ML "win" here re-derives the definition, not new signal. Test but flag; not a promotable "new" driver.
- **REJECTED:** `NY.GDP.MKTP.KD.ZG` (circular — a recession IS negative GDP growth), `SL.UEM.TOTL.ZS` (coincident/lagging, Okun), yield-curve/house-price/confidence (absent).

## Acceptance bar — hardened (purist edits)
- **D6 GFC-2008 concentration = FAST PRE-FILTER (run FIRST):** 13.2% of positives are 2008 — a candidate that's purely a global-2008-time-effect is rejected before spending the rest of the battery.
- Standard battery: D1 coverage-matched (0.547) · D2 placebo · D3 orthogonality/income-proxy (run on `FD.AST.PRVT.GD.ZS` FIRST given its 0.36 correlation) · D4 **coincident-vs-leading lag-decay** (must lift from t-2/t-3, not just t-1) · D5 per-country · **D7 minimum-effect-size floor: ΔAUC 95% CI-lower > +0.02** (NOT just >0 — the baseline CI-lower is already 0.507, near chance) + BH-FDR · locked temporal hold-out.
- Sequence: `FD.AST.PRVT.GD.ZS` → `FM.LBL.BMNY.GD.ZS` (investment only as a flagged sanity check).

## Stop rule
None clears (incl. the +0.02 floor) → **record ~0.547 as recession's honest ceiling with the current substrate**, note the missing yield-curve/house-price mechanisms as a substrate gap (would need external sourcing), move on. No further indicator search this cycle.

## Odds (prior)
LOW — near-chance baseline + the best mechanisms absent from the panel + borderline-coverage candidates. **~20–35%** of clearing the +0.02 bar.

---

## OUTCOME (2026-07-11) — CEILING 0.547; substrate gap

None of the 5 candidates cleared. All blocked at **D1 coverage-at-positive-cells (≥80%)**: credit-level 79.6% (0.4pp short), credit-accel3 73.6%, M2 72.4%, M2-decel3 69.6%, investment 75.6%. Additionally **both credit candidates fail D3 income-proxy** (FD.AST.PRVT.GD.ZS correlates r=0.606 with GDP-per-capita — a development-level proxy, not a business-cycle signal; the acceleration transform doesn't launder it). M2 + investment pass D3/D6 cleanly, blocked only on coverage. GFC-2008 pre-filter: 4/5 not pure-2008 effects (signal uniformly weak, not a shock artifact). 66/66 battery tests pass.

**VERDICT: 0.547 is economic_recession's honest ceiling with the current substrate.** The real blocker is a **SUBSTRATE GAP**, not a search failure: the best recession predictors (yield-curve/term-spread, house prices, confidence) are absent from the panel, and the available macro series (credit/M2) fall short on coverage. → No enrichment possible via the existing pool. The lever that could help is **sourcing new indicator data** (yield-curve series, house-price indices; and an M2/GDP coverage top-up) — a different, bigger project than searching. No live number at risk (recession never LOCKed).

---

## REBOOT OUTCOME (2026-07-11) — RED this pass; 2 live leads remain

Sourced 5 new indicators outside the 250-pool (BIS credit-gap + house-prices, WB equity + terms-of-trade + commodity-shock interaction; crosswalk 106/106; 168 pure-fn tests). **Real coverage screen killed 3 of 5** even OECD-scoped: credit-gap 77.6%, equity 59.7%, ToT 47.8% (FAIL); **house-prices 82.1% + commodity-shock 95.5% (PASS)**. OECD-scoped test on 26 countries / 65-67 events:
- **Scoped baseline = 0.587** (run-2 drivers on the ex-ante OECD subset — NOT 0.547; scoping lifts it ~4pp, guard #1 worked → no mirage).
- **Scoped candidate (run-2 + house-prices + commodity-shock) = 0.617, ΔAUC +0.019, CI [−0.096, +0.125], p=0.75** — crosses zero, misses the +0.02 floor. **REJECTED** by: (1) 2008 era-decomposition (pre-2008 AUC **0.427, below chance** — works only in the recent era); (2) D4 lag-decay (commodity-shock is **coincident-only**, t-2/t-3 below chance).
- Universal ToT/commodity walk: fails coverage (35.6%) + non-significant (+0.002). REJECT.

**VERDICT: RED — 0/5 program record holds. But 2 genuine leads survive for a future pass:**
1. **House-prices (`BIS.SPP.REAL.YOY`) is the one clean indicator** — passes coverage, orthogonality, income-proxy, placebo, AND lag-decay (leading). It was only tested *jointly* (dragged down by commodity-shock's noise); **never alone with the drivers.** Worth a focused re-test.
2. **The OECD yield-curve / term-spread — the single strongest predictor — was NEVER sourced** (Cloudflare-blocked; needs a free OECD API key or a browser export). Untested. This is the real remaining shot.

**Also:** the 67-event OECD sample is statistically thin (hold-out couldn't bind) — the honest completion is house-prices + yield-curve **together**, on the OECD set, ideally with a few more OECD recession events for power. Substrate improved but still short of a validated win; recession's honest ceiling with *currently-pullable* data ≈ 0.59 (scoped) / 0.55 (universal). Artifacts: `reboot/`.
