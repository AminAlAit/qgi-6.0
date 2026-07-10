"""EM-eligibility classification for the banking EM-scoped external-fragility test
(PLAN.md `experiments/banking-enrichment/PLAN.md` §11 Step 0-1, committed 98c703e, LOCKED).

**Classification source (DOCUMENTED per §11's explicit fallback clause):** §11 asks for a
"WB income-group / IMF-WEO advanced-economy classification at event year t-1". Neither a
World Bank income-group table nor an IMF WEO advanced-economy list exists anywhere in this
repo or `qgi-data` (verified: `grep -rli "income.group|income_group|advanced.econom|IMF.WEO"`
across both repos, zero hits, 2026-07-10). Per §11's own authorized fallback ("if only the
cohort file is available locally, use stable-democracy as the advanced proxy and DOCUMENT the
choice") this module uses `qgi-data/reference/cohort-assignments.json`'s
`stable-democracy` / `mid-tier` / `fragile-state` cohort as the advanced-economy proxy:
advanced = `stable-democracy`; EM-eligible = `mid-tier` OR `fragile-state`.

**KNOWN LIMITATION (spot-checked per §11's explicit ask, must be reported alongside the
commitment):** `cohort-assignments.json` is a POLITICAL-STABILITY/governance cohort (used by
the production per-cohort LOCK gates), NOT an economic-development classification. Spot-check
of the named twin-crisis countries (D5) against real years:
  - Mexico 1994 (t-1=1993) -> mid-tier -> EM-eligible.        MATCHES domain expectation.
  - Thailand/Indonesia 1997 (t-1=1996) -> mid-tier/fragile-state -> EM-eligible. MATCHES.
  - Russia 1998 (t-1=1997) -> mid-tier -> EM-eligible.         MATCHES.
  - Turkiye 2001 (t-1=2000) -> mid-tier -> EM-eligible.        MATCHES.
  - South Korea 1997 (t-1=1996) -> stable-democracy -> NOT EM-eligible under this proxy
    (`select_architecture`/coverage note: South Korea is a graduation-edge case the real WB
    income-group table would ALSO likely classify as high-income by 1996-97 -- so this is
    plausibly a genuine agreement, not a proxy artifact).
  - **Argentina 2001 (t-1=2000) -> stable-democracy -> NOT EM-eligible under this proxy.**
  - **Brazil 1994 (t-1=1993) -> stable-democracy -> NOT EM-eligible under this proxy.**
Argentina and Brazil are two of the seven D5 named twin-crisis countries and are NOT
classified as advanced economies by any real income/WEO scheme circa 1993/2000 -- this is a
proxy MISCLASSIFICATION (the cohort file is scoring political/democratic stability, which
Argentina and Brazil score well on, not GNI per capita or IMF advanced-economy status). This
means the D5 per-country-decomposition acceptance gate (§11 bar #5) will evaluate on a
5-of-7-country named-twin-crisis subset (Mexico, Thailand, Indonesia, Russia, Turkiye), NOT
all 7 -- Argentina'01 and Brazil'94 rows are excluded from the EM-eligible sample entirely
under this proxy. **Flagged here for founder/orchestrator review; not silently absorbed.**

Country names passed to this module must already be normalized to the Title-Case form used by
`cohort-assignments.json` / the parquet panels (`run_f_ml_1_poc.normalize_country_id`) --
normalization itself is exercised only in the Docker-only orchestration path
(`build_em_commitment`) below, keeping every function in this section pure/host-testable
(same DI split as `widenet/temporal_holdout.py`).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[2]
QGI_DATA_ROOT = QGI_ML_ROOT.parent / "qgi-data"

ADVANCED_COHORT_DEFAULT = "stable-democracy"
# Mirrors run_f_ml_1_poc.py's binding architecture rule (~line 1654:
# `architecture = "LR" if n_pos < 60 else "XGBoost"`). Duplicated as a local constant
# (kept in sync manually; low drift risk -- one int) rather than importing the heavy
# joblib/pandas-dependent module just for a threshold, matching temporal_holdout.py's
# precedent for MIN_POS_SURVIVAL et al.
ARCHITECTURE_NPOS_THRESHOLD = 60

DEFAULT_COHORT_ASSIGNMENTS_PATH = QGI_DATA_ROOT / "reference" / "cohort-assignments.json"
DEFAULT_POSITIVES_CSV = (
    QGI_ML_ROOT / "data" / "shape_inputs_v2" / "banking_and_financial_crisis" / "positives.csv"
)


# ============================================================================================
# Pure helpers (json + dict only -- no pandas/numpy needed even; host-testable, no ML stack).
# ============================================================================================
def load_cohort_assignments(path: Path = DEFAULT_COHORT_ASSIGNMENTS_PATH) -> dict[str, dict[str, str]]:
    """Load `qgi-data/reference/cohort-assignments.json`'s `assignments` dict:
    {country_title_case: {year_str: cohort}}."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return data["assignments"]


def cohort_at(assignments: dict[str, dict[str, str]], country: str, year: int) -> str:
    """Exact-year cohort lookup. Fails LOUD (KeyError) on an unknown country or a year the
    assignments file does not cover -- never fabricates/interpolates a cohort."""
    if country not in assignments:
        raise KeyError(f"cohort_at: country {country!r} not found in cohort-assignments.json")
    country_years = assignments[country]
    key = str(year)
    if key not in country_years:
        raise KeyError(
            f"cohort_at: {country!r} has no cohort assignment for year {year} "
            f"(covered years: {min(country_years, default=None)}-{max(country_years, default=None)})"
        )
    return country_years[key]


def em_eligible(
    assignments: dict[str, dict[str, str]],
    country: str,
    event_year: int,
    advanced_cohort: str = ADVANCED_COHORT_DEFAULT,
) -> dict[str, Any]:
    """Ex-ante, LEAK-SAFE EM-eligibility for one (country, event_year) row: consults the
    cohort at event_year - 1 (t-1) ONLY, so a country's own crisis year -- or a later
    graduation (e.g. South Korea/Poland/Chile) -- can never reclassify it (§11's binding
    requirement). `advanced_cohort` is injectable for tests; production callers use the
    default (`stable-democracy`, per this module's documented proxy choice above)."""
    lag_year = event_year - 1
    cohort = cohort_at(assignments, country, lag_year)
    return {
        "country": country,
        "event_year": event_year,
        "lag_year": lag_year,
        "cohort_t_minus_1": cohort,
        "em_eligible": cohort != advanced_cohort,
    }


def select_architecture(n_pos: int, threshold: int = ARCHITECTURE_NPOS_THRESHOLD) -> str:
    """The binding, no-nudging n_pos<threshold -> LR / n_pos>=threshold -> XGBoost rule
    (mirrors run_f_ml_1_poc.py verbatim; boundary is >=, matching the source's strict `<`)."""
    return "LR" if n_pos < threshold else "XGBoost"


def classify_positives(
    assignments: dict[str, dict[str, str]],
    positives: list[tuple[str, int]],
    advanced_cohort: str = ADVANCED_COHORT_DEFAULT,
) -> list[dict[str, Any]]:
    """Classify every (country, event_year) positive. Fails loud (propagates KeyError, with
    the offending country/year visible in the message) on the first unresolvable row -- a
    commitment built on a silently-dropped positive would be exactly the kind of post-hoc
    slippage §11 forbids."""
    return [em_eligible(assignments, c, y, advanced_cohort) for c, y in positives]


def classify_rows_tolerant(
    assignments: dict[str, dict[str, str]],
    rows: list[tuple[str, int]],
    advanced_cohort: str = ADVANCED_COHORT_DEFAULT,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Like `classify_positives`, but TOLERANT of unresolvable rows (unknown country, or a
    year the cohort file does not cover) -- returns `(resolved, unresolved)` instead of
    raising. Used to EM-filter the FULL `samples` DataFrame (positives + time-matched
    negatives) for the run-2 baseline recompute (§11 Step 2): a negative row drawn for an
    unresolvable country/year must be DROPPED + COUNTED, never silently kept in an
    ambiguous bucket or allowed to crash the whole baseline fit. `classify_positives`
    itself stays strict (fail-loud) for the §11 COMMITMENT step, where a silently-dropped
    positive would corrupt the binding n_pos count."""
    resolved: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []
    for country, year in rows:
        try:
            rec = em_eligible(assignments, country, year, advanced_cohort)
        except KeyError as exc:
            unresolved.append({"country": country, "event_year": year, "reason": str(exc)})
        else:
            resolved.append(rec)
    return resolved, unresolved


def summarize_em_eligibility(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Reduce `classify_positives`'s per-row records to the §11 COMMITMENT payload: the
    EM-eligible n_pos + the architecture it binds under `select_architecture`, plus the
    full eligible/advanced country breakdown for audit. Empty input -> n_pos=0 -> LR
    (never crashes on the degenerate case)."""
    n_total = len(records)
    em_recs = [r for r in records if r["em_eligible"]]
    adv_recs = [r for r in records if not r["em_eligible"]]
    n_em = len(em_recs)
    return {
        "n_pos_total": n_total,
        "n_pos_em_eligible": n_em,
        "n_pos_advanced": n_total - n_em,
        "architecture": select_architecture(n_em),
        "architecture_npos_threshold": ARCHITECTURE_NPOS_THRESHOLD,
        "em_eligible_countries": sorted({r["country"] for r in em_recs}),
        "advanced_countries": sorted({r["country"] for r in adv_recs}),
        "em_eligible_rows": em_recs,
        "advanced_rows": adv_recs,
    }


# ============================================================================================
# Orchestration (Docker-only: needs run_f_ml_1_poc.normalize_country_id, which imports
# numpy/pandas/joblib at module scope). Never imported by the pure tests above.
# ============================================================================================
def build_em_commitment(
    positives_csv: Path = DEFAULT_POSITIVES_CSV,
    cohort_assignments_path: Path = DEFAULT_COHORT_ASSIGNMENTS_PATH,
    advanced_cohort: str = ADVANCED_COHORT_DEFAULT,
    out_path: Path | None = None,
) -> dict[str, Any]:
    """The §11 COMMITMENT entrypoint: classify every positive in `positives_csv`, reduce to
    the binding n_pos_em_eligible + architecture, and (if `out_path` given) write it to disk
    BEFORE any AUC is computed -- this function must run, and its output must be persisted,
    strictly before `run_em_baseline.py` (or any candidate scoring) executes."""
    import pandas as pd

    scripts_dir = QGI_ML_ROOT / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    import run_f_ml_1_poc as w  # noqa: E402  (heavy import; Docker-only)

    pos_df = pd.read_csv(positives_csv)
    pos_df["country"] = pos_df["country_id"].apply(w.normalize_country_id)
    positives = list(zip(pos_df["country"].tolist(), pos_df["event_year"].astype(int).tolist()))

    assignments = load_cohort_assignments(cohort_assignments_path)
    # `cohort-assignments.json` does not cover every positive-set country (e.g. two small
    # Caribbean states absent entirely: verified below). classify_positives() is deliberately
    # STRICT (fails loud per-row, exercised by test_em_classification.py) -- so here, at the
    # orchestration layer, we explicitly partition resolvable vs unresolvable rows FIRST,
    # rather than let one missing country crash the whole commitment or, worse, silently
    # swallow it into either bucket. Unresolved rows are reported by name/year and excluded
    # from BOTH n_pos_em_eligible and n_pos_advanced -- never guessed.
    resolvable, unresolved = [], []
    for country, year in positives:
        try:
            cohort_at(assignments, country, year - 1)
        except KeyError as exc:
            unresolved.append({"country": country, "event_year": year, "reason": str(exc)})
        else:
            resolvable.append((country, year))

    records = classify_positives(assignments, resolvable, advanced_cohort)
    summary = summarize_em_eligibility(records)
    summary["n_pos_unresolved_no_cohort_data"] = len(unresolved)
    summary["unresolved_positives"] = unresolved
    summary["proxy_source"] = str(cohort_assignments_path)
    summary["advanced_cohort_label"] = advanced_cohort
    summary["positives_csv"] = str(positives_csv)
    summary["known_limitation"] = (
        "cohort-assignments.json is a political-stability/governance cohort, not an "
        "economic-development classification. Spot-check: Argentina 2001 (t-1=2000) and "
        "Brazil 1994 (t-1=1993) resolve to 'stable-democracy' under this proxy and are "
        "therefore EXCLUDED from the EM-eligible subset, even though neither is a real "
        "advanced economy circa their crisis year. South Korea 1997 (t-1=1996) is also "
        "excluded but plausibly agrees with a real income-group table by then. This means "
        "the D5 named-twin-crisis per-country decomposition (PLAN.md §11 bar #5) evaluates "
        "on 5-of-7 named countries (Mexico, Thailand, Indonesia, Russia, Turkiye), not all "
        "7 -- see this module's docstring for the full spot-check."
    )

    if out_path is not None:
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[em_classification] wrote {out_path}")
    print(
        f"[em_classification] COMMITMENT: n_pos_em_eligible={summary['n_pos_em_eligible']} "
        f"(of {summary['n_pos_total']}) -> architecture={summary['architecture']!r}"
    )
    return summary


def main(argv: list[str] | None = None) -> int:
    import argparse

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--positives-csv", type=Path, default=DEFAULT_POSITIVES_CSV)
    ap.add_argument("--cohort-assignments", type=Path, default=DEFAULT_COHORT_ASSIGNMENTS_PATH)
    ap.add_argument("--advanced-cohort", type=str, default=ADVANCED_COHORT_DEFAULT)
    ap.add_argument("--out", type=Path, default=HERE / "results" / "em_commitment.json")
    args = ap.parse_args(argv)
    build_em_commitment(args.positives_csv, args.cohort_assignments, args.advanced_cohort, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
