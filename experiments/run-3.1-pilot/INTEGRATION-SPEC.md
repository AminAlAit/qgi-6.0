# run-3.1 pilot — INTEGRATION SPEC (authoritative; build agents obey verbatim)

**Role of this file.** This is the SPEC AGENT's contract for reusing the production walk
`qgi-ml/scripts/run_f_ml_1_poc.py` (hereafter *the walk*) without reimplementing it. Every
signature, return shape, call order, and the LOCO firewall argument below was verified by
reading the walk end-to-end (lines 1–1906) plus the local data. The build agents
(`stability_select`, `baseline`, `score_pilot`) depend on this being exact.

Cross-refs: `PRE-REGISTRATION.md` (spec of record) and `criteria.yaml` (machine-readable bar).
The FROZEN INTER-MODULE CONTRACT in the build brief is the JSON schema; this file tells you how
to *produce* those fields from the reused functions.

---

## 0. How to import the walk + the environment gap (READ FIRST)

The walk is at `/workspace/qgi-6.0/qgi-ml/scripts/run_f_ml_1_poc.py`.
Import it by adding its dir to `sys.path`; the module self-inserts `scripts/`, `src/`, and repo
root at import time (walk lines 85–90), so the module-level `import beta_calibration as _beta_cal`
(walk line 96, resolves to `qgi-ml/src/beta_calibration.py`) succeeds automatically. **Do not
copy/paste any walk function — import them.**

```python
import sys
from pathlib import Path
_SCRIPTS = Path(r"/workspace/qgi-6.0/qgi-ml/scripts")
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
import run_f_ml_1_poc as walk   # this triggers the walk's own sys.path setup + beta_calibration import
```

**ENVIRONMENT GAP (blocking for the RUN step, not for writing code).** No Python environment on
this machine currently has the walk's runtime deps. Verified interpreters:
- `python3` (3.13.14) — **no** numpy/pandas/xgboost.
- `WindowsApps/python.exe` — Store stub, non-functional.
- venvs `qgi-4.0/.venv` (broken pyenv shim) and `qgi-x-venv` (3.13, no ML pkgs).

The walk needs: `numpy, pandas (+ pyarrow OR fastparquet to read the parquet panels), xgboost,
scikit-learn, scipy, joblib`; `threadpoolctl` is optional (walk falls back to a no-op, lines
76–83); `matplotlib` is only needed by `plot_saudi_azeri_audit` which the pilot **does not call**.
There is no dedicated lockfile for the walk (the repo's `requirements-shape.lock.txt` /
`requirements-path-b.lock.txt` are for the Bayes/shape tracks, Python 3.12, and are NOT this
stack). **Action for the run agent / founder:** create a Python 3.13 venv and `pip install
numpy pandas pyarrow xgboost scikit-learn scipy joblib` before any walk executes. Build agents
can still write + unit-test their modules against tiny fixtures without the full stack, but the
5-recipe pilot run requires the venv.

---

## 1. Exact signatures + return shapes of every reused function

All live in `run_f_ml_1_poc.py`. Panel DataFrames have exactly three columns:
**`country`** (Title-Case string, e.g. `"Costa Rica"`), **`year`** (int), **`value`** (float)
(walk `load_panel` docstring + all downstream `panel["country"]/["year"]/["value"]` access).

### 1.1 `list_candidate_indicators(panel_dir: Path) -> list[str]`
Returns `sorted([p.name for p in panel_dir.iterdir() if p.is_dir()])` — the 248 indicator IDs
(subdir names) under `data/parquet_panels/`. This IS the 248-indicator pool for both arms.

### 1.2 `load_panel(indicator_id: str, panel_dir: Path) -> pd.DataFrame`
Reads `panel_dir/{ind}/{ind}.parquet`. Returns the 3-col panel. Load all panels once into
`panels: dict[str, pd.DataFrame] = {ind: load_panel(ind, panel_dir) for ind in all_candidates}`
and pass that dict everywhere (mirrors walk line 1580).

### 1.3 `normalize_country_id(country_id: str) -> str`
Maps a `positives.csv` `country_id` (snake_case) to the panel's Title-Case form. 12 of 16
multi-word ids via `replace("_"," ").title()`, 4 via `COUNTRY_NAME_OVERRIDES` (DRC, Guinea-Bissau,
Republic of the Congo, Timor-Leste). **Mandatory** — skipping it silently drops multi-word
countries at feature-extraction time.

### 1.4 `build_samples(pos, negatives_per_positive=3, seed=0, valid_years=range(1980,2023), time_matched=True) -> pd.DataFrame`
- `pos` MUST carry columns `country` (already normalized), `year` (int), `label` (=1).
- Returns a DataFrame with columns **`country`, `year`, `label`** = all positives (label=1) followed
  by sampled negatives (label=0). Positives keep their real years even if outside `valid_years`.
- Negatives: `time_matched=True` (default) draws negative YEARS from the positives' own empirical
  year distribution; drawn via `np.random.default_rng(seed)`.
- **DETERMINISM CONTRACT (load-bearing):** same `pos` + same `seed` ⇒ byte-identical `samples` ⇒
  identical country set ⇒ identical LOCO folds across arms, resamples, baseline. Seed base = 12345.

### 1.5 `univariate_loco_screen(samples, candidates, panels, default_window=10, top_n=TOP_N_PREFILTER) -> (top_n_inds: list[str], scores: dict)`
- `TOP_N_PREFILTER = 40`. Runs a cheap **LR** LOCO at a fixed 10y window per candidate, applies the
  coverage gate, ranks by global LOCO-AUC desc, returns the top-`top_n` list.
- `scores` is keyed by **every** candidate (regardless of `top_n`): `scores[ind] =
  {"univariate_loco_auc": float (NaN if coverage-fail or <30 valid rows), "n_valid": int,
  "pos_coverage": float}`. Ranking key (walk line 841): `score if not NaN else -1.0`, `reverse=True`.
- **This `univariate_loco_auc` is the "best-univariate-LOCO representative" score used by the dedup
  step** (§5). One screen call yields both the top-40 AND the full per-indicator score table.

### 1.6 `greedy_outer_loop(samples, candidates_top_n, panels, architecture, delta_step=0.005, max_steps=None, seed=0, checkpoint_path=None, config_signature=None, min_pos_survival=0.50, min_effective_npos=30, min_survive_countries=10, min_neg_survival=0.60, lock_floor=None, min_steps_before_abort=3, n_jobs=1) -> dict`
- Greedy forward selection over `candidates_top_n`; at each step evaluates every (candidate × window
  in `WINDOW_GRID=[3,5,7,10,12,15,18,21,25]`) via full LOCO, adds the best if lift ≥ `delta_step`.
- Returns: `{"selected_indicators": list[str], "chosen_window": int|None, "final_global_auc": float,
  "history": [...], "early_abort_floor_unreachable": bool}`.
- **Pilot call settings (fixed):** `architecture="XGBoost"`, `n_jobs=1`, `delta_step=0.005`,
  `checkpoint_path=None`, `config_signature=None` (no resume — each resample-walk is independent),
  **`lock_floor=None`** (so the floor-aware early-abort NEVER truncates a resample walk — we want
  the natural greedy stop, not a compute abort), coverage thresholds left at defaults ("greedy
  unchanged" per PRE-REG §2.2).
- `max_steps` (cap): compute per walk exactly as `_main` does — `THIN_RECIPE_CAP(=5)` if the
  *subset's* `n_pos < 60` else `--max-greedy-steps(=12)`. See §2 note on thin halves.
- The stability arms consume ONLY `result["selected_indicators"]`.

### 1.7 `build_X_y(samples, selected_indicators, window, panels, feat_cache=None) -> (X, y, countries, years)`
- `X`: `np.ndarray (n_valid, 8*len(selected_indicators))`; `y`: `(n_valid,)` int labels;
  `countries`: `(n_valid,)` str; `years`: `(n_valid,)` int.
- Iterates `samples.iterrows()` in order; **drops a row if ANY selected indicator lacks a valid
  window** (coverage). ⇒ the 4 returned arrays are mutually 1:1 aligned and in samples-row order,
  but the surviving row SET depends on `selected_indicators` (different sets ⇒ different rows drop).
- Each indicator contributes an 8-feature block `[last_z, mean_z, std_z, slope, accel, t1m, t2m, t3m]`
  from `extract_features_for_indicator` (walk lines 300–354). Feature block order matches
  `selected_indicators` order.

### 1.8 `extract_features_for_indicator(panel, country, year, window) -> np.ndarray|None`
Pure/deterministic 8-vector for one (indicator, country, year, window), or `None` if insufficient
window data. **This is the exact feature the model sees** — reuse it (via `build_X_y`) for the
dedup correlation (§5) so |r| is computed on model features, not raw values.

### 1.9 `fit_predict_loco(X, y, countries, years, architecture, seed=0) -> dict`
- Leave-One-**Country**-Out CV: iterate `sorted(set(countries))`; for held country `h`,
  `train_mask = countries != h`, `test_mask = countries == h`; train on train, predict test.
  XGBoost is `XGBClassifier(n_estimators=200, max_depth=6, lr=0.05, reg_alpha=0.1,
  scale_pos_weight=neg/pos, random_state=seed, n_jobs=1)`.
- Returns: `{"probs": np.ndarray, "labels": np.ndarray, "countries": np.ndarray,
  "years": np.ndarray, "per_country_auc": dict, "global_auc": float}`. See §3 for OOF alignment.

### 1.10 `compute_auc(probs, labels) -> float`
Mann-Whitney U AUC (ties = 0.5). NaN if a class is empty.

### 1.11 `bca_bootstrap_auc_ci(probs, labels, B=2000, seed=0) -> dict`
BCa bootstrap. Returns `{"auc": float (POINT estimate — key is "auc", NOT "point"),
"ci80_lo","ci80_hi","ci95_lo","ci95_hi","n_bootstrap","method"}`. For the frozen-contract
`loco_auc`/`ci95_lo`/`ci95_hi` use `["auc"]`,`["ci95_lo"]`,`["ci95_hi"]` with `seed=12345`.
(This `B` is the CI's internal resampling — distinct from the stability schedule B and from
`criteria.yaml b_eval=1000` which `score_pilot` uses for the *paired* ΔAUC test.)

### 1.12 Provenance helpers (for the frozen-contract metadata fields)
- `panel_data_fingerprint(panel_dir, positives_csv=None) -> str` (16-hex) — content hash (by
  file size) of every `*.parquet` under `panel_dir` + the positives CSV. **Use this for
  `pool_hash`.** Stable across re-syncs; changes on a real data vintage change.
- `greedy_config_signature(recipe_id, candidates_top_n, architecture, delta_step, max_steps, seed,
  data_fingerprint) -> str` (sha256) — available if an arm wants a per-walk `config_signature`;
  otherwise compose your own over `(recipe_id, arm, pool_hash, seed_base, b_schedule,
  abs_r_threshold)`.
- `git_commit`: **do NOT shell out to git** (standing rule for these agents). Accept via a CLI flag
  / `GIT_COMMIT` env var; default `"UNKNOWN"` if absent.
- `seed_base`: literal `12345`.

---

## 2. Exact call sequence to run ONE walk arm on a samples subset → `selected_indicators`

Inputs: `samples_subset` (a DataFrame with `country/year/label`, restricted to one country-half),
`all_candidates` (the 248 pool), `panels` (dict), `resample_seed` (= 12345 + resample_index).

Fixed decisions (isolate the selection layer per PRE-REG §2):
- **`architecture = "XGBoost"`** everywhere. Determined once from the FULL-sample `n_pos` via the
  `_main` rule `LR if n_pos<60 else XGBoost`; all 5 pilot recipes have full-sample n_pos ∈
  {511,105,203,75,162} ≥ 60 ⇒ XGBoost. Do **not** recompute architecture per half (a half may dip
  below 60; flipping to LR would change the layer under test and break pairing). Hold XGBoost fixed.
- **`max_steps = 5 if int((samples_subset["label"]==1).sum()) < 60 else 12`** (production cap rule,
  computed on the subset's own n_pos — "greedy caps as-is", PRE-REG §2.2).

```python
def run_arm(arm, samples_subset, all_candidates, panels, resample_seed):
    n_pos_sub = int((samples_subset["label"] == 1).sum())
    max_steps = 5 if n_pos_sub < 60 else 12

    if arm == "run3method":                      # OLD: NO dedup
        top40, scores = walk.univariate_loco_screen(samples_subset, all_candidates, panels)
        dedup_cluster_map = {}                   # no dedup → empty map
    elif arm == "run31":                         # NEW: dedup, then top-40 of survivors
        # one screen gives scores for ALL 248 (scores dict is exhaustive regardless of top_n)
        _, scores = walk.univariate_loco_screen(samples_subset, all_candidates, panels)
        survivors, dedup_cluster_map = correlation_dedup(          # see §5
            all_candidates, samples_subset, panels, scores, abs_r=0.85)
        top40 = sorted(
            survivors,
            key=lambda i: (scores[i]["univariate_loco_auc"]
                           if not math.isnan(scores[i]["univariate_loco_auc"]) else -1.0),
            reverse=True,
        )[:walk.TOP_N_PREFILTER]                 # mirrors the screen's own ranking (walk line 841)

    greedy = walk.greedy_outer_loop(
        samples_subset, top40, panels, architecture="XGBoost",
        delta_step=walk.DELTA_STEP, max_steps=max_steps, seed=resample_seed,
        checkpoint_path=None, config_signature=None, lock_floor=None, n_jobs=1,
    )
    return greedy["selected_indicators"], dedup_cluster_map
```

Both arms share the identical univariate screen and greedy; the ONLY difference is the dedup step
between screen and top-40 (that is the whole experiment).

### 2.1 Building the country-partition resamples (firewall-safe; §6)
Build `samples` ONCE from the full positives at seed 12345 (canonical), then partition its COUNTRIES
per resample. Do NOT rebuild negatives per half — subsetting the canonical `samples` by country
keeps pairing exact.

```python
pos = pd.read_csv(positives_csv)                       # header: country_id,event_year
pos["country"] = pos["country_id"].apply(walk.normalize_country_id)
pos = pos.rename(columns={"event_year": "year"}); pos["label"] = 1
samples = walk.build_samples(pos, negatives_per_positive=3, seed=12345)   # canonical

def resample_halves(samples, resample_index):
    countries = np.array(sorted(samples["country"].unique()))            # deterministic order
    rng = np.random.default_rng(12345 + resample_index)                  # PRE-REG §2.3 seed rule
    perm = rng.permutation(len(countries))
    half = len(countries) // 2
    A = set(countries[perm[:half]]); B = set(countries[perm[half:]])     # complementary PARTITION
    sub_A = samples[samples["country"].isin(A)].reset_index(drop=True)
    sub_B = samples[samples["country"].isin(B)].reset_index(drop=True)
    return sub_A, sub_B
```

Each complementary-pairs resample index `i` yields **two walks** (halves A and B), both run with
`resample_seed = 12345 + i`. "B" in the schedule `[50,75,100,125,150,175,200]` counts **walks**, so
B=50 ⇒ 25 resample indices ⇒ 50 selected sets. `π_j = (#walks selecting j) / B`; stable core =
`{j : π_j ≥ 0.60}`. (This accounting + the two-consecutive-checkpoint stop rule are the
`stability_select` agent's logic; the reused functions above are all it needs.)

---

## 3. Obtaining per-(country,year) OOF predictions aligned to samples rows

`fit_predict_loco` returns four **mutually aligned** arrays: `probs[k]`, `labels[k]`,
`countries[k]`, `years[k]` all describe the same held-out prediction k. **The order is grouped by
held-out country (`sorted(set(countries))`), NOT the input samples-row order** — so align OOF via
the returned `countries`+`years`, never via samples index.

Build the frozen-contract `oof` list directly:
```python
res = walk.fit_predict_loco(X, y, c, yr, architecture="XGBoost", seed=12345)
oof = [{"country": str(res["countries"][k]), "year": int(res["years"][k]),
        "prob": float(res["probs"][k]), "label": int(res["labels"][k])}
       for k in range(len(res["probs"]))]
loco_auc = float(res["global_auc"])            # == compute_auc(res["probs"], res["labels"])
ci = walk.bca_bootstrap_auc_ci(res["probs"], res["labels"], B=2000, seed=12345)
# ci95_lo=ci["ci95_lo"], ci95_hi=ci["ci95_hi"]
```

Because `probs/labels` ARE the pooled OOF predictions (each country scored by a model trained on the
other countries), they are exactly what the paired ΔAUC consumes — no retraining.

**Pairing caveat for `score_pilot` (flagged here, owned there):** run-2's set and an arm's stable
core drop DIFFERENT rows in `build_X_y` (coverage depends on the selected indicators). So the two
`oof` lists can differ in length/coverage. The paired bootstrap must run on the **intersection**
matched by `(country, year)`; because duplicate-negative `(country,year)` rows can occur (negatives
are sampled with possible repeats), match with a per-key **occurrence index** (k-th `(c,y)` in run2
↔ k-th in the arm; both lists preserve the same `(c,y)` ordering since both derive from the same
canonical `samples`). Rows present in only one arm are excluded from the paired test.

---

## 4. Cohort sidecar + positives loading; can the pilot run without a real sidecar?

**Positives** (mirror `_main` lines 1528–1531 exactly) — header is `country_id,event_year`
(verified: `afghanistan,1975`). Path default `data/shape_inputs_v2/{recipe_id}/positives.csv`.
Row counts (incl. header): civil_war 511, exec_power 105, military_coup 203, banking 75,
territorial 162 positives. See the snippet in §2.1.

**Cohort sidecar** — `_main` (lines 1559–1561) does
`cohort_assignments = json.load(open(args.cohort_sidecar))["assignments"]`; default path
`qgi-data/reference/cohort-assignments.json` (**present locally**, 804 KB, top keys
`["assignments","cutoffs","filed","lineage","purpose","schema_version"]`; `assignments` is
`{TitleCaseCountry: {"YYYY": "fragile-state"|"mid-tier"|"stable-democracy"}}`).

**Can the pilot run WITHOUT a sidecar? YES.** The sidecar is used ONLY by
`per_cohort_loco_and_ece` + the per-cohort LOCK gates (walk lines 1704–1736). The pilot's critical
path — `build_samples → univariate_loco_screen → correlation_dedup → greedy_outer_loop → build_X_y
→ fit_predict_loco → bca_bootstrap_auc_ci` — and every field in the FROZEN INTER-MODULE CONTRACT
(`pi, stable_set, loco_auc, ci95_lo/hi, oof, n_pos, …`) require **zero** cohort data. **Do not load
the sidecar; do not call `per_cohort_loco_and_ece`.** (It exists if a build agent wants optional
per-cohort diagnostics, loaded the same way, but nothing in the pilot contract needs it, so the
pilot is fully self-contained without one.)

---

## 5. Where to insert dedup + how to compute the |r| correlation feature vector

**Insertion point:** in arm `run31` ONLY, **between** the univariate screen and the top-40 cut (see
§2 `run_arm`). Per PRE-REG §2.1 dedup is "pre-top-40": it runs on the full 248 pool, collapses
collinear clusters to one representative each, and the top-40 is then taken from the survivors.
`run3method` skips this entirely (its `dedup_cluster_map = {}`).

**Feature vector for |r| — reuse `build_X_y`/`extract_features_for_indicator` so the correlation is
on the SAME 8-dim features the model sees** (NOT raw indicator values). Use the univariate screen's
window (`default_window = 10`) so dedup and screen share one feature basis (dedup precedes greedy,
so no `chosen_window` exists yet).

```python
def correlation_dedup(all_candidates, samples_subset, panels, scores, abs_r=0.85,
                      window=10, min_common=30):
    # 1. Per indicator: an 8-vec per surviving sample row, keyed by (country, year).
    feats = {}                                   # ind -> { (country,year): np.ndarray(8) }
    for ind in all_candidates:
        X, y, c, yr = walk.build_X_y(samples_subset, [ind], window, panels)
        feats[ind] = {(str(c[k]), int(yr[k])): X[k] for k in range(len(X))}

    # 2. Pairwise collinearity metric on COMMON rows, per-feature-column Pearson |r|,
    #    aggregated as the MEAN of the 8 column-|r| (robust: a true near-duplicate is
    #    collinear across ALL 8 derived features; a coincidental single-column match is not).
    def collinear(a, b):
        common = sorted(set(feats[a]) & set(feats[b]))
        if len(common) < min_common:             # can't establish collinearity → NOT merged
            return False
        A = np.vstack([feats[a][k] for k in common])   # (n_common, 8)
        B = np.vstack([feats[b][k] for k in common])
        rs = []
        for col in range(8):
            va, vb = A[:, col], B[:, col]
            if np.std(va) < 1e-9 or np.std(vb) < 1e-9:
                continue                          # degenerate column contributes no evidence
            rs.append(abs(np.corrcoef(va, vb)[0, 1]))
        return len(rs) > 0 and float(np.mean(rs)) > abs_r

    # 3. Single-linkage connected components (union-find) at threshold abs_r.
    #    Deterministic given sorted candidate order.
    # 4. Per component keep the member with the highest scores[ind]["univariate_loco_auc"]
    #    (NaN -> -1.0); that member is the cluster representative.
    # 5. dedup_cluster_map = {rep: [all members incl. rep]}; survivors = list of reps.
    return survivors, dedup_cluster_map
```

Notes locked for reproducibility:
- Aggregation = **mean of per-column |Pearson r|** across the 8 feature columns (the spec choice).
  Rationale: near-duplicate indicators are collinear on all 8 engineered features; averaging avoids
  a spurious merge from one incidentally-correlated column. (Rejected alternative: flatten the
  `(n_common×8)` block to one vector and correlate once — blends heterogeneous feature semantics.)
- `min_common = 30` guards against declaring collinearity on too few shared rows.
- Degenerate (near-constant) feature columns are skipped, not counted as r=0, to avoid diluting the
  mean toward "not collinear".
- Cluster reps come from `scores` (the univariate LOCO-AUC already computed by the screen on THIS
  subset) → "best-univariate-LOCO representative per cluster" with no extra fits.
- `dedup_cluster_map` (frozen contract `{rep:[members]}`) is emitted only for `run31`.

---

## 6. Confirmed firewall: country-partition resampling cannot leak a country into its own LOCO test fold

**Claim.** No row of a held-out country ever appears in the training data of the fold that holds it
out, within any single walk. Verified against `build_samples`, `build_X_y`, `fit_predict_loco`.

1. Every row carries a `country` label from `build_samples`; determinism (seed 12345) fixes the row
   set. Negatives are tagged by country too, so ALL of a country's rows (positives + negatives)
   share one country key.
2. The stability wrapper resamples at **country level as a PARTITION**: `resample_halves` permutes
   the unique-country array and splits it into two **disjoint, complementary** sets A and B. A given
   country lands in **exactly one** half — never split, never duplicated within a resample. This is
   complementary-**pairs** (without-replacement assignment), NOT with-replacement bootstrap of rows
   or countries.
3. Each walk sees exactly one half's `samples_subset`. `build_X_y` preserves each row's `country`.
4. `fit_predict_loco` does LOCO by iterating `sorted(set(countries))` of that subset; for held `h`,
   `train_mask = countries != h` and `test_mask = countries == h`. Since `h` is a single country
   value and every one of its rows matches `test_mask` (and is therefore excluded from
   `train_mask`), **no row of `h` is in both train and test of the same fold** (walk lines 616–618).
5. The classic leak — a *with-replacement* resample drawing the same country twice, then holding one
   copy out while its duplicate sits in training — is **structurally impossible here**: a country is
   assigned IN or OUT of a half exactly once; there is no duplicate copy to leak. Row-level
   resampling (the forbidden path) is never used; only the disjoint country partition is.
6. The final full-sample fit and the run-2 baseline both call `fit_predict_loco` on the SAME
   canonical `samples`, LOCO-grouped by country → same firewall, and paired because identical
   samples/seed ⇒ identical country folds.

**Verdict: FIREWALL HOLDS.** Country-partition (complementary-pairs, without-replacement) resampling
provably cannot leak a country into its own held-out LOCO fold. The one thing a build agent must NOT
do is switch to with-replacement resampling of countries or any row-level resampling — that would
reintroduce the duplicate-country leak this design avoids.

---

## 7. Quick reference — frozen-contract field → source

| Field | Source |
|---|---|
| `pi`, `stable_set`, `resample_selected_sets`, `per_checkpoint`, `B_used`, `stop_reason` | `stability_select` accounting over `run_arm` outputs (§2/§2.1) |
| `reference_set` | ONE deterministic full-sample greedy walk (dedup applied for `run31`, not `run3method`) at seed_base — the "locked set" `score_pilot` measures the π-coverage / mean-π bars over (NOT `stable_set`, which is `{π≥0.60}` and would make those bars tautologically 1.0) |
| `loco_auc`, `ci95_lo`, `ci95_hi` | `fit_predict_loco` + `bca_bootstrap_auc_ci` on FULL samples w/ stable core (§3), seed 12345 |
| `oof` | zip of `fit_predict_loco` `countries/years/probs/labels` (§3) |
| `n_pos` | `int((samples["label"]==1).sum())` (canonical full samples) |
| `final_indicator_count` | `len(stable_set)` |
| `dedup_cluster_map` | `correlation_dedup` (§5); `{}` for `run3method` |
| `config_signature` | `greedy_config_signature` or arm-composed (§1.12) |
| `git_commit` | env/CLI, default `"UNKNOWN"` (do NOT run git) |
| `pool_hash` | `panel_data_fingerprint(panel_dir, positives_csv)` |
| `seed_base` | `12345` |
| baseline `selected_set` | run-2 recorded set from the build brief; run through §3 on the SAME canonical samples |

**Final-fit window for the FULL-sample fit (arm stable core AND run-2 baseline):** mirror `_main`
lines 1781–1791 — evaluate `build_X_y(samples, S, w)` + `fit_predict_loco` for each `w` in
`WINDOW_GRID`, pick `w* = argmax global_auc` (tie → smallest w), and use `w*`'s OOF for
`loco_auc`/CI/`oof`. Each set thus gets its own learned canonical length, matching production; the
paired ΔAUC (score_pilot) remains paired on identical country folds regardless of window because it
pairs OOF rows by `(country,year)` (§3 caveat).
