# 250-Indicator Run — Selection Record

**Goal:** grow the Trajectory-Engine indicator pool **109 → 250** by selecting **141** new indicators. Reusable for the later 250 → 500 step.

**Date:** 2026-06-25/26 · **Branch:** `enrichment/250-run-catalog`

## Method (fully reproducible)

1. **Enumerate every reachable CC-BY indicator** across all 10 providers, excluding the 109 we already have. Six parallel sourcing agents pulled live provider catalogs/APIs → **1,725 candidate indicators** (`reachable-pool.json`; per-provider provenance in `enumeration/`). Exclude-set in `enumeration/existing-109-excluded.txt`.
2. **8-persona QGI panel selection.** Eight Sonnet agents, each a distinct expert lens (macro-fragility · V-Dem/governance · conflict-security · social-unrest/demography · ML-fit purist · coverage/quality skeptic · Trends-portfolio strategist · orthogonality economist), each grounded in exactly how a QGI Trend works (per-recipe top-40 univariate screen → greedy XGBoost → cosine-similarity scoring; coverage gate; n_pos≥60).
   - **Round 1:** each independently picked 141 from the full pool → **607 distinct** indicators considered.
   - **Round 2:** each saw the group vote tally and converged (keep the ≥5/8 consensus core, resolve the contested middle).
   - **Chair:** reconciled the converged votes into the final 141, balanced across providers / categories / Trend families.

## Result — the 141 (`selected-141.json`)

**Agreement (genuine consensus):** 77 unanimous (8/8) · 28 at 7/8 · 19 at 6/8 · 10 at 5/8 · 7 at 4/8. **124 of 141 (88%) carry ≥6-of-8 agreement.**

**Providers (original pre-audit selection):** V-Dem 45 · WB 26 · UCDP 16 · OWID 15 · IDMC 10 · UNHCR 9 · FAOSTAT 8 · ILOSTAT 8 · UNDP 4. **OECD 0** — panel deliberately excluded it (≈38-country coverage fails the global coverage gate). **→ After the 2026-06-26 license audit (see addendum), the live 141 is: V-Dem 55 · WB 27 · UCDP 20 · UNHCR 11 · FAOSTAT 8 · OWID 8 · ILOSTAT 8 · UNDP 4 · IDMC 0.**

**Categories:** Governance 56 · Social 31 · conflict-deaths (“Other”) 14 · Economic 12 · Government 8 · Environment 6 · Military 4 · Finance 4 · Trade 3 · Demographic 2 · Health 1.

**Known tilt:** governance/V-Dem-heavy. This reflects QGI's political-risk core, and the **per-recipe top-40 prefilter prunes collinear V-Dem indices automatically at walk time**, so the redundancy self-corrects. Founder may opt to rebalance toward economic/social/conflict before activation.

## Files

| File | What |
|------|------|
| `reachable-pool.json` | 1,725 reachable CC-BY candidates (minus 109) — the universe the panel chose from |
| `selected-141.json` | the chosen 141 (code · provider · category · votes · name · note · license) |
| `enumeration/enum-*.json` | per-provider raw enumerations (provenance) |
| `enumeration/existing-109-excluded.txt` | the 109 we already had (exclude-set) |
| `catalog/` | interactive review catalog (trends-ref + enriched data + localhost page) |

## Next

Founder decision on the 141 (accept / rebalance / review via the `catalog/` page) → load into `qgi-data/registries/candidate-registry.json` (held-WB flip `hold→process`; new picks add as `vetted`) → push 7 fetcher images → fetch → vet + challenger-gate → te-fleet-run-3 → Majles top-40 prefilter ruling.

## License audit + backfill (2026-06-26)

A post-selection COMMERCIAL-license audit (QGI is sold commercially) found the original enumeration had mis-tagged some licenses. Verified against official sources:

- **DROPPED 17 (non-commercial / proprietary):** IDMC x10 (CC BY-NC-SA 3.0 IGO, confirmed in the IDMC API schema); OWID x7 whose underlying sources are proprietary/NC -- SIPRI (military spend), GTD/START x2 (terrorism), WJP x3 (rule of law), RSF (press freedom).
- **KEPT (verified commercial-OK):** WB, UCDP, ILOSTAT, UNHCR, UNDP (CC BY / CC BY-IGO); FAOSTAT (CC BY 4.0 -- the "commercial promotion" clause bars advertising, not feature-use); V-Dem (official FAQ: "open source and free for anyone to use, no permission needed" -- already in production; a formal written OK is advisable since V-Dem does not stamp a CC version); OWID-clean x8 (V-Dem / UN / Hanson-Sigman sources).
- **BACKFILLED 17** via the same 8-persona panel from a license-clean pool (1,370 candidates; WB/V-Dem/FAOSTAT/ILOSTAT/UCDP/UNHCR/UNDP only), covering every lost signal: displacement -> UNHCR x2; rule-of-law/corruption -> V-Dem x7; press freedom -> V-Dem x3; terrorism/violence -> UCDP x4; military spend -> WB x1. 12 of 17 unanimous.

Net count still 141, now all commercial-license-clean. Registry: the 17 dropped -> `quarantined` (reason: license); the 17 backfill -> `vetted`. Sources: V-Dem FAQ, FAOSTAT db-terms-of-use, IDMC API #copyright.


## Final composition (post license-audit + fetchability swap, 2026-06-27)
The historical Result/Provider/Category counts above are the ORIGINAL pre-audit selection. The LIVE, fully-fetchable + commercial-license-clean 141 is:
- **Providers:** V-Dem 57 · WB 29 · UCDP 19 · UNHCR 11 · FAOSTAT 8 · ILOSTAT 8 · OWID 5 · UNDP HDR 4
- **Categories:** Governance 59 · Social 27 · Other 16 · Economic 11 · Government 10 · Finance 5 · Environment 4 · Military 3 · Trade 3 · Demographic 2 · Health 1
- The 9 fetchability-swap replacements carry `votes: null` (selected by panel + live-verify, not a new 8/8 scoring round) — exclude them when citing the 8/8 agreement stats (those describe the 132 scored picks).
