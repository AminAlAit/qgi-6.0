# QGI-GPR — creds-ready runbook (execute the moment `qgi-claude-readonly` lands)

> **Who runs this:** the **founder**, with the read-only BigQuery role. Claude holds
> **no** AWS/GCP creds (qgi-aws-tf#809); every step below is a command the founder
> pastes, plus the explicit guard rail at that step. **Nothing here has been run.**
>
> **Two hard rules govern every step:**
> - **#809 (no-creds):** Claude never assumes creds. Phase-A raw scan **and** any
>   table WRITE need a **write-capable** role — `qgi-claude-readonly` is *not* enough
>   for Phase A; the founder runs the CREATE/INSERT deliberately. The read-only role
>   covers Phase B reads + all dry-runs.
> - **#807 (cost):** every BigQuery touch gets a **FREE** `--dry_run` byte estimate
>   first, then `cost-preflight.sh`, then **explicit founder cost-ack** before any real
>   query. STOP verdict ⇒ per-run sign-off with cost-rate acknowledgement.
>
> **Honesty (carry into every artifact and any external line):** this is a
> **re-implementation on a different corpus** (GDELT machine-coded vs Caldara-Iacoviello's
> ~10 newspapers, different normalization window, different country attribution). It is a
> *"GDELT re-implementation calibrated to Caldara-Iacoviello (2022)"* — **never** "the GPR".
>
> All paths are absolute. All commands assume cwd `<USER_HOME>/Desktop/trojan/qgi-6.0/qgi-ml/gpr-build`.

---

## ⚠ BEFORE you start — apply the v2 → v2.1 dictionary fix (the adversarial-review P0s)

The pre-creds adversarial review (against the **free** GKG master theme list — zero BQ
bytes) found that **`gpr-theme-dictionary-v2.json` ships two empty/broken categories and
a false-positive trap.** Do **not** run the backfill on v2 as-is. Resolve these first
(they are already answered from the free registry — no BigQuery needed to confirm
existence, only to confirm non-zero counts in the panel at Step 1):

| Fix | Category | Action |
|-----|----------|--------|
| **P0-1** | cat 4 | `NUCLEAR` **does not exist** as a GKG theme. Replace with `WMD \| WB_2503_WEAPONS_PROLIFERATION_AND_ARMS_CONTROL \| MIL_WEAPONS_PROLIFERATION`. Keep `WB_509_NUCLEAR_ENERGY` only as an **exclude**. Demote cat 4 to weak/global-`SHAREH_CAT_4`-only (IRN has no GPRC column). |
| **P0-2** | cats 2/3/4 | Fix wrong WB node numbers: `WB_588_NUCLEAR_ENERGY`→`WB_509_NUCLEAR_ENERGY`; `WB_2457_PEACE_OPERATIONS`→`WB_2470_PEACE_OPERATIONS_AND_CONFLICT_MANAGEMENT` (+`WB_2471_PEACEKEEPING`); `WB_2466_ARMS_AND_MILITARY_EXPENDITURE` does not exist → drop (use `SLFID_MILITARY_SPENDING`). |
| **P0-3** | cat 3 | **Remove `TAX_MILITARY` from verify_on_creds** — only `TAX_MILITARY_TITLE*` exists (80M+ docs of ranks/titles); the stem is a catastrophic FP trap. Never include. |
| **P0-4** | several | Delete confirmed-nonexistent verify_on_creds tokens so they don't lull a later "verify and add": `MILITARY_TENSION`, `WAR_RISK`, `MOBILIZATION`, `ARMS_CONTROL`-standalone, `TAX_WEAPONS_NUCLEAR`, `RADICALIZATION`, `AIRSTRIKE`, `SIEGE`, `TAX_TERROR`, `TAX_TERROR_BOMBING`, `SUICIDE_ATTACK`. |
| **P1** | cats 3/5/8 | Real adds that exist: cat 3 `TAX_WEAPONS` (tree) / `SLFID_MILITARY_SPENDING` / `MIL_SELF_IDENTIFIED_ARMS_DEAL` / `MILITARY_COOPERATION`; cat 5 add `JIHAD`, drop `RADICALIZATION`; cat 8 add `ASSASSINATION` / `TAX_WEAPONS_SUICIDE_BOMBER` / `TAX_TERROR_GROUP_*`. |

Produce **`gpr-theme-dictionary-v2.1.json`** with the corrected token set, bump
`version` to `2.1.0`, and point `gpr_rollup.py`'s `DICT_FILE` at it (one-line change),
**or** edit v2 in place and re-tag. The renderer reads the dictionary as the single
source of truth, so the SQL updates automatically. Then proceed.

> **Reality check on the gate (carry to the founder):** the genuine threat-side unlock
> that survives the registry is only the `TAX_WEAPONS_*` tree (cat 3) + `WMD`/`WB_2503`/
> `MIL_WEAPONS_PROLIFERATION` (cat 4), and those skew kinetic/realized. **Expect v2.1 to
> track the Acts half (GPRA, cats 6-8) well and still under-detect the pure-Threat half —
> the same skew as v1, modestly improved, not eliminated.** The 8-way split is not
> achievable on themes (no `AIRSTRIKE`/`SIEGE`/`TAX_TERROR_BOMBING`); validate the
> threats(1-5)/acts(6-8) split and the subject groupings, not 8 separate categories.

---

## Step 0 — Confirm the read-only role + region (no query, no cost)

```bash
# Confirm you are authenticated to the OWNED GCP project (NOT a public dataset), read-only.
gcloud config get-value project          # expect: extreme-lattice-344211
gcloud auth list                          # confirm the active account is the read-only role
bq --project_id=extreme-lattice-344211 ls qgi_gdelt   # list owned tables; expect gkg_topic_flags
```

**Guard:** if `gcloud auth list` shows a **write-capable** principal, note it — you will
need it for Phase A (Step 4a) but should run Steps 1-3 + Phase B on the **read-only** role
so a mistake cannot write. If no creds: `cost-preflight.sh` (Step 3) hard-STOPs with
"no AWS credentials" — that is the #809 contract working, not an error.

---

## Step 1 — Verify dictionary-v2.1 tokens exist in GKG (FREE — zero BQ bytes)

The token-**existence** question is already answered from the free GKG master theme list
(see the P0 table above). This step **confirms non-zero counts** in the real corpus for
the corrected token set — the cheapest possible check, against the free public lookup, not
a raw scan.

```bash
# Option A (truly $0): download the free GKG-THEMES lookup CSV and grep the v2.1 tokens.
#   data.gdeltproject.org  →  LOOKUP-GKGTHEMES.TXT   (theme<TAB>count). No BigQuery at all.
curl -s http://data.gdeltproject.org/api/v2/guides/LOOKUP-GKGTHEMES.TXT -o gkg-themes-lookup.txt
# Confirm each rendered token stem appears with a non-trivial count:
grep -E 'WB_2468_CONVENTIONAL_WAR|WB_2462_POLITICAL_VIOLENCE|WB_2433_CONFLICT_AND_VIOLENCE|TERROR|WB_2467_TERRORISM|ARMEDCONFLICT|TAX_WEAPONS|WMD|WB_2503_WEAPONS_PROLIFERATION|MIL_WEAPONS_PROLIFERATION|SLFID_MILITARY_SPENDING|WB_2470_PEACE_OPERATIONS|WB_2471_PEACEKEEPING|WB_509_NUCLEAR_ENERGY|ASSASSINATION' gkg-themes-lookup.txt

# Option B (BQ but still free, if you prefer counts from the owned corpus window):
#   a metadata/dry query — see Step 2; a SELECT DISTINCT over the lookup table is < a few MB.
```

**Guard:** any rendered token that is **absent** from the lookup silently matches **zero**
docs at scale — fix the dictionary now, before spending Phase-A bytes. Do **not** proceed
to Step 2 with an unconfirmed token in the `gkg_themes` (rendered) set.

---

## Step 2 — Render + dry-run the roll-up (FREE byte estimate; no creds needed to render)

The runner is **safe by default** (`--dry_run` is the default; a real run needs **both**
`--execute` and `--confirm`). Render first, eyeball the SQL, then capture the byte estimate.

```bash
# 2a. Render-only sanity check — prints the rendered SQL, no creds, no query:
python gpr_rollup.py --phase A --slice 2015-02-18 2016-01-01 --print-sql   # one backfill slice
python gpr_rollup.py --phase B --print-sql                                  # the steady-state read

# 2b. Default DRY RUN — prints the exact FREE `bq ... --dry_run` command to paste.
#     This emits the command; it does NOT run BQ itself unless you add --execute --confirm.
python gpr_rollup.py --phase A --slice 2015-02-18 2016-01-01     # CAUTION: raw scan slice
python gpr_rollup.py --phase B                                   # GO: owned-table read

# 2c. Paste the printed command to get the byte number (FREE — a dry-run never bills):
"/workspace\google-cloud-sdk\bin\bq.cmd" query --use_legacy_sql=false \
  --project_id=extreme-lattice-344211 --maximum_bytes_billed=200000000000 --dry_run \
  "<the single-line SQL the runner printed>"
# Read the "Query successfully validated. ... will process N bytes" line. Record N.
```

**Guard:**
- Phase A is the **only** cost driver (raw `gkg_partitioned` scan, `_PARTITIONTIME`-pruned,
  5-column projection). **Backfill in yearly slices** (`--slice START END`, end exclusive)
  so each query's bytes stay capped under `--maximum_bytes_billed=200GB`.
- Phase B touches only the **owned** date-partitioned `qgi_gdelt.gkg_gpr_flags` → first
  1 TB/month is **free**.
- If the dry-run **errors** instead of returning bytes: a token or WB number is wrong
  (matches nothing) or the partition field is misspelled. Fix and re-dry-run — still free.

---

## Step 3 — Cost-preflight + SURFACE the byte/$ number to the founder (STOP gate)

```bash
export PATH="$PATH:/c/Program Files/GitHub CLI"   # (only if gh is needed for sign-off logging)
/c/Users/Amin/Desktop/trojan/qgi-6.0/qgi-aws-tf/scripts/cost-preflight.sh --account staging
```

Then compute the dollar figure from the Step-2 byte number and **surface it for explicit
sign-off**:

- `$ ≈ (N_bytes / 1e12) * 6.25`  (on-demand $6.25/TB; **first 1 TB/month is free**).
- A full-history themed backfill via pruned BQ is expected to be **single-digit TB, one
  time** (tens of dollars worst case) — see build-plan §5.

**Guard / decision rule (#807):**
- `cost-preflight.sh` prints a 5-line summary + **GO / CAUTION / STOP**.
- **Phase B (owned read) = GO** — proceed.
- **Phase A (raw backfill) = CAUTION** — founder must **ack the single byte figure** before
  `--confirm`.
- **STOP verdict** (or a byte number larger than the single-digit-TB expectation) ⇒ **halt**,
  per-run founder sign-off with explicit cost-rate acknowledgement. Do not `--confirm` a
  surprising byte count — re-examine the slice bounds / token set first.

---

## Step 4 — On founder GO, run the roll-up → per-(country, month) GPR-proxy series

### 4a. Phase A (one-time backfill, **write role**, CAUTION)

`qgi-claude-readonly` cannot write. The founder runs Phase A with a **write-capable** role,
in yearly slices, `--confirm`-ing each acked byte figure:

```bash
# Per slice (CREATE runs once via IF NOT EXISTS on the first slice; INSERT runs every slice):
python gpr_rollup.py --phase A --slice 2015-02-18 2016-01-01 --execute --confirm
python gpr_rollup.py --phase A --slice 2016-01-01 2017-01-01 --execute --confirm
# ... advance the lower bound per slice through present; closed slices are never re-scanned.
```

> **Note:** the PRE-CREDS scaffold deliberately stops at a `STOP:` SystemExit before any
> write — it prints the dry-run estimate but does **not** wire the real CREATE/INSERT.
> Founder: port `seed_live_baseline.py`'s `bq_query` write path to land the owned table
> (the runner docstring + the in-code STOP message say exactly this). This keeps the
> destructive step a deliberate human action, not an autonomous one.

### 4b. Phase B (steady-state read, **read-only role**, GO) → the proxy CSV

```bash
python gpr_rollup.py --phase B --execute --confirm        # all 44 GPRC FIPS (default)
python gpr_rollup.py --phase B --all-countries --execute --confirm   # all ~215 (P3 extend)
```

Phase B is a read-only `SELECT` over the owned table. Founder: port
`seed_live_baseline.bq_query(csv_out=...)` to write the result CSV
(`country_code, month, total_docs, g1..g8, gpr_matched, gpr_share, threats_share,
acts_share, avg_tone`).

**Guard — country attribution:** the 44-country FIPS list rendered into the filter is
**ILLUSTRATIVE / verify-on-creds** (KS=S.Korea, SF=S.Africa, SZ=Switzerland, GM=Germany,
UP=Ukraine are typo-prone). **Build the authoritative FIPS↔ISO3 map for all 44 from a
reference table** before trusting per-country output — a wrong FIPS silently matches
nothing and a country falsely "fails" the gate.

### 4c. Convert the Phase-B CSV → the harness proxy JSON

`validate_gpr_full.py` scores a `{ISO3: {YYYY-MM: value}}` proxy. Map the CSV's FIPS
`country_code` → ISO3 (the authoritative map from 4b), pick the validation column
(headline = `gpr_share`; also produce `threats_share` and `acts_share` for the split):

```bash
# (small stdlib+xlrd converter — write it from the CSV; one {ISO3:{YYYY-MM:val}} dict)
#   -> gpr-proxy-blended.json    (gpr_share)
#   -> gpr-proxy-threats.json    (threats_share)   # the threat-skew test
#   -> gpr-proxy-acts.json       (acts_share)
```

---

## Step 5 — Validate vs all 44 GPRC → per-country r, r>0.9 production gate, calibrated RMSE

The harness is **PRE-CREDS-safe** (reads only the local answer key + a proxy JSON; no BQ).
Run it on each proxy. The gate metric is **explicit and reported** — never silently switched
(Ji-Hoon must-fix #1).

```bash
# Headline blended proxy vs all 44 GPRC_<ISO3>, PRODUCTION gate r>=0.90 on the CALIBRATED levels:
python validate_gpr_full.py --proxy-json gpr-proxy-blended.json \
  --gate 0.90 --gate-metric pearson_levels_calibrated \
  --out gpr-full-results-blended.json

# The threat-skew test (does v2.1 track GPRT better than v1's t02+t03 did?):
python validate_gpr_full.py --proxy-json gpr-proxy-threats.json \
  --gate-metric pearson_levels_calibrated --out gpr-full-results-threats.json
python validate_gpr_full.py --proxy-json gpr-proxy-acts.json \
  --gate-metric pearson_levels_calibrated --out gpr-full-results-acts.json

# Sanity: rebuilding the PoC (t02+t03)/total proxy from topic_monthly.csv must reproduce 0.4554:
python validate_gpr_full.py --out gpr-full-results-poc-check.json   # mean delta-Spearman 0.4554
```

Each run reports, per covered country: `n_months`, **levels-Pearson** (trend-inflated
*diagnostic*), **delta-Spearman** (the honest co-movement *headline*), delta-Pearson,
2015-2019 / 2020+ temporal-stability split, de-trended spike-recall, RMSE-z, and the
affine-**calibrated** holdout RMSE in his GPRC units. The production-gate count is reported
against the **named** `--gate-metric`, with the bar note distinguishing the 0.9 production
target (calibrated levels) from the PoC's 0.35 mean-delta-Spearman gate.

**Guards:**
- **Production gate** = per-country r ≥ 0.90 on the **calibrated levels** series (build-plan
  §7). If too strict for low-news countries, the pre-registered fallback is **r ≥ 0.80 +
  correct spike timing** (decide with Ji-Hoon/Kwame) — do **not** lower the bar silently.
- **Affine calibration** fits `a + b·proxy` on the chronological **first 60%** and reports
  RMSE on the held-out tail — correlations are affine-invariant; RMSE needs the calibration.
  This is a calibration, not a gap-closer regressor (the regressor is a separate, later,
  D2-carve-out-gated step — build-plan §3.4/§8).
- **cat 4 / nuclear** has no per-country gate (IRN has no GPRC column) — validate cat 4
  against **global `SHAREH_CAT_4`** only.
- **Signed r** is used, so an anti-correlated proxy (e.g. a peacekeeping-contaminated cat 2)
  correctly **fails** — watch for negative r as a token-contamination signal.

---

## Step 6 — Report pass/fail per country; decide what ships as "GPR-validated"

From the Step-5 JSONs, produce the per-country verdict table and the ship list:

- **Ships as "GPR-validated":** countries that **clear the production gate** on the blended
  proxy (calibrated levels r ≥ 0.90, or the ratified fallback bar).
- **Ships as "QGI-GPR (uncalibrated)":** every covered country that **misses** the gate, plus
  the **7 PoC countries with no GPRC column** (BGD/IRN/LBN/MMR/NGA/PAK/SDN) and **all of the
  ~215 that Iacoviello does not cover at all** (no answer key ⇒ no calibration possible).
  **Never** label these "GPR-validated".
- **Threats/acts finding:** report whether `threats_share` tracks GPRT/sum(SHAREH_CAT_1..5)
  **materially better than v1** — the honest measure of whether v2.1 reduced the threat-skew.
  The honest prior (from the registry review) is "somewhat, not dramatically."

**Surface to the founder before any frontend/comms:** the per-country pass/fail table, the
ship-list split (validated vs uncalibrated), the threat-skew delta vs v1, and the four
standing asymmetries (different corpus / different normalization window / threat-act skew /
country-attribution mechanism). Per the standing R&D rule, **stop at the data layer** — do
not autopilot frontend wiring; the frontend surface is build-plan **P4**, founder-gated.

---

## One-screen checklist

| # | Action | Cost | Role | Guard |
|---|--------|------|------|-------|
| 0 | confirm role + region + owned project | $0 | read-only | write-role only for Phase A |
| 1 | verify v2.1 tokens non-zero (free lookup CSV) | $0 | none | absent token ⇒ matches nothing; fix first |
| 2 | render + `--dry_run` byte estimate | $0 | read-only | yearly slices; cap 200GB; default is dry |
| 3 | `cost-preflight.sh` + surface $ to founder | $0 | read-only | STOP/large ⇒ halt, per-run sign-off |
| 4a | Phase A backfill (CREATE/INSERT) | **single-digit TB, 1×** | **write** | `--execute --confirm` per acked slice |
| 4b | Phase B owned read → CSV | free-tier | read-only | FIPS↔ISO3 authoritative map |
| 5 | `validate_gpr_full.py` vs 44 GPRC | $0 | none | named gate metric; signed r; calibrated RMSE |
| 6 | per-country verdict + ship list | $0 | none | "GPR-validated" only if gate passes; else "uncalibrated" |

**Pre-creds artifacts this runbook drives** (all in `<USER_HOME>/Desktop/trojan/qgi-6.0/qgi-ml/gpr-build/`):
`gpr-theme-dictionary-v2.json` (→ fix to v2.1), `gpr_rollup.sql` (template),
`gpr_rollup.py` (renderer + dry-run guard), `validate_gpr_full.py` (44-country harness),
`test_gpr_full.py` + `test_gpr_rollup.py` (29 tests, all passing).
