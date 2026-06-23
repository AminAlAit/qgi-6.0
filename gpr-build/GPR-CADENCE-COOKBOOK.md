# QGI-GPR — Cadence Cookbook & Owned-Table Guide

**Status:** Durable reference. Written 2026-06-23 from a verified session run.
**One-line:** QGI-GPR is **daily-native** in the owned BigQuery table; the monthly `gpr-country.json` is just **one** `GROUP BY`. **Any** cadence (daily/weekly/monthly) is a **free owned-table read** — no GDELT re-scan, no new backfill.
**Companion to:** `CREDS-READY-RUNBOOK.md` (the original monthly build), `gpr_rollup_v2.sql` (the Phase-A backfill + Phase-B monthly rollup), `qgi-gpr-build-plan.md`.
**Governs cost via:** [gcp-bq-cli-access-policy.md](../../qgi-docs/internal/ops/gcp-bq-cli-access-policy.md) (proposed) — every `bq` touch dry-runs first.

---

## 0. The fact that changes everything

The owned table **`extreme-lattice-344211.qgi_gdelt.gkg_gpr_flags_v2`** stores **one row per (document, country, `event_date`)** — i.e. it is **daily-resolution** (GDELT GKG is 15-minute native; the flag table is collapsed to one row per doc×country×day). ~3B rows, **partitioned by `event_date`, clustered by `country_code`**.

So the cadence of any QGI-GPR series is **purely a choice of `GROUP BY` bucket**, made at read time, against an **already-built owned table**. The expensive part — the raw GDELT backfill into this table (the ~$24 / 26 GB effort, Phase A) — **is done**. Re-bucketing it is a free-tier owned read.

> **The trap (do not repeat):** the frontend `gpr-country.json` is **monthly** *only because that is the baked artifact* (built from `C:/tmp/gpr_proxy44_v2.json`, a monthly rollup). Reading the baked artifact and concluding "GPR is monthly" is wrong — and was concluded **twice** in the 2026-06-23 session before founder correction. **Always trace the upstream pipeline table (`gkg_gpr_flags_v2`), not the baked artifact.** A baked file shows one cadence; the table holds all of them.

### Table schema (the columns that matter)
`doc_id`, `event_date` (DATE), `country_code` (**FIPS 2-letter**), `slice_id`, `g1_war_threats`…`g8_terror_acts` (8 BOOL GPR categories), **`gpr_any`** (doc-OR across the 8), `tone`, `matched_themes` (ARRAY, for cheap future re-flagging).

---

## 1. The proxy formula (one definition, all cadences)

The QGI-GPR proxy for a country in a time bucket is the **share of that country's flagged documents that hit any GPR category**:

```
gpr_share = SAFE_DIVIDE(COUNTIF(gpr_any), COUNT(DISTINCT doc_id))   -- per (country_code, bucket)
```

This is the **same `gpr_share`** that the live frontend serves. Verified **bit-for-bit** 2026-06-23: `ARG 2015-02 = 0.28789706812908666` is identical in the weekly CSV (aggregated), `gpr_monthly_v2.csv`, and `gpr-country.json`. Do not invent a different proxy — `gpr_share` is canonical.

---

## 2. The cadence recipe — only the bucket key changes

| Cadence | Bucket expression |
|---|---|
| Monthly (the baked default) | `FORMAT_DATE('%Y-%m', event_date)` |
| **Weekly** (ISO week, Monday-start) | `DATE_TRUNC(event_date, WEEK(MONDAY))` |
| Daily | `event_date` |

### The weekly query (verified 2026-06-23, saved at `C:/tmp/gpr_weekly.sql`)
```sql
SELECT
  country_code,
  DATE_TRUNC(event_date, WEEK(MONDAY))                  AS bucket,
  COUNT(DISTINCT doc_id)                                AS total_docs,
  SAFE_DIVIDE(COUNTIF(gpr_any), COUNT(DISTINCT doc_id)) AS gpr_share
FROM `extreme-lattice-344211.qgi_gdelt.gkg_gpr_flags_v2`
WHERE country_code IN (<the 44 FIPS codes>)   -- clustered key → cheap; omit for all ~215
GROUP BY country_code, bucket
ORDER BY country_code, bucket
```
Output (2026-06-23): **25,829 rows, 587 weeks, 44 countries**, columns `country_code, bucket, total_docs, gpr_share`. Latest complete week `2026-05-25` (covers May 25–31), prior `2026-05-18`. Saved to `C:/tmp/gpr_weekly_v2.csv`.

---

## 3. Cost — it is free

Phase B reads **only the owned table** (no raw GDELT). The **dry-run for the full 44-country × 587-week range = 104,014,519,091 bytes ≈ 104 GB ≈ 0.10 TB**, which is **under the 1 TB/month BigQuery free tier → $0** (worst case ~$0.65 at $6.25/TB if the tier is exhausted). The query ran in ~6 seconds. **Always `--dry_run` first** and read the byte figure before the real run (cost rule; see the bq-access policy doc).

### Cost-optimal practice (founder rule 2026-06-23 — "use the most cost-optimized methods")
The 104 GB above is the **full-history** scan; a movers card needs only the **latest ~2 weeks**, so that scan was larger than necessary. Standing rules, cheapest-first:
1. **Partition-prune to the dates you need.** The table is partitioned by `event_date`; add `WHERE event_date >= …` so you scan only the needed weeks. For the recurring weekly card: `WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 8 WEEK)` → **~1–2 GB instead of 104 GB (~70× less)**, and it stays bounded as the table grows. Reserve a full-history scan for a genuine one-time pull.
2. **Cap the spend:** `--maximum_bytes_billed=10000000000` (10 GB) on every steady-state run — a runaway query then errors instead of billing.
3. **Column-prune** (already done): select only `country_code, event_date, doc_id, gpr_any`; never `SELECT *` (skip the big `matched_themes` array).
4. **Use the cluster key** (already done): `WHERE country_code IN (…)` hits the `country_code` clustering → fewer bytes.
5. **Result cache is free:** an identical query re-run within 24 h returns the cached result at $0.
6. **Owned read, never a public re-scan:** Phase B (owned table) is free-tier; `gdelt-bq.gdeltv2.*` is billed.

`bq` prerequisites on this machine:
- `export CLOUDSDK_PYTHON="$(command -v python3.12)"` (else bq errors).
- Binary: `/c/Users/Amin/google-cloud-sdk/bin/bq` (Git Bash) or `…/bq.cmd` (cmd/PowerShell).
- Authed as `aminalait.de@gmail.com`, project `extreme-lattice-344211`.
- **Windows-store `python3.12` needs `C:/…` paths, NOT git-bash `/c/…`** (a recurring foot-gun in any Python that post-processes the CSV).

---

## 4. FIPS → ISO3 (the one mapping you must apply)

The owned table stores **FIPS** 2-letter country codes (`AR`, `SZ`, `KS`, `SF`, `UP`…); the frontend, cards, and `gpr-country.json` use **ISO3** (`ARG`, `CHE`, `KOR`, `ZAF`, `UKR`…). The **authoritative 44-country map** is:

```
qgi-ml/gpr-build/gpr-full-results.json  →  ["fips_to_iso3_map"]   (44 entries, verified)
```
(Also cached locally at `C:/tmp/fips2iso3.json`.) Sample: `AR→ARG, AS→AUS, SZ→CHE, CI→CHL, KS→KOR, SF→ZAF, UP→UKR, TS→TUN`. A wrong FIPS silently matches **nothing**, so a country falsely "vanishes" — always map from this file, never hand-type.

Tiers (A/B/C strong/confirmed/weak) come from `gpr-country.json` (per-country `tier`); they are the **monthly-validated** quality stamp (Δ-Spearman vs Caldara-Iacoviello) and apply to any cadence as a *quality* label, not a cadence-specific score.

---

## 5. ⚠ GOTCHA — the `rollup_*` tables are NOT GPR

The `qgi_gdelt` dataset also contains `rollup_weekly`, `rollup_daily`, `rollup_hourly`, `rollup_4h`, `topic_monthly`. **These are the 14-TOPIC news-pulse rollups** (columns `t01…t14`, derived from `gkg_topic_flags`) — the *live news-pulse* layer, **NOT** the 8-category GPR (`g1…g8` / `gpr_any` from `gkg_gpr_flags_v2`). Same dataset, entirely different data product. **Never read a `rollup_*` table expecting GPR.** GPR at any cadence comes from `gkg_gpr_flags_v2` only.

---

## 6. Recurring use (as the owned table extends)

- The owned table's latest data = the last backfill cutoff (2026-05-31 as of this writing). For a **fresh** week, the steady-state Phase-B pattern is: extend the owned table forward (a small dated raw-scan slice, founder-run with a write role — that part is CAUTION/STOP cost), then re-run the **free** weekly read. The *re-bucketing* is always free; only *extending* the table touches raw GDELT.
- To regenerate the v6 **GPR-movers X card** from a refreshed weekly series: recompute movers from `C:/tmp/gpr_weekly_v2.csv` (latest-week vs prior-week % change, FIPS→ISO3, attach tiers), then rebuild the card batch — see the card spec in `qgi-docs/internal/outreach/twitter-x/engine/v6-cards-playbook.md` §7F.

---

## 7. Paper trail
- **2026-06-23 session.** Founder asked for a weekly GPR-mover X card. Claude first concluded "monthly only" off `gpr-country.json` (wrong); founder pushed ("we've done this effort before"); tracing to `gkg_gpr_flags_v2` revealed the daily-native truth. Founder authorized Claude to drive `bq` directly; dry-run (104 GB, free-tier) → ran the weekly query → reconciled the proxy bit-for-bit → built the (shelved) v6 GPR-movers cards.
- Memory: `project_gpr_weekly_movers_card.md`. Flagship R&D context: `project_gpr_poc_go.md` (validated GPR, KEEP-NAIVE, r>0.9 unreachable).
