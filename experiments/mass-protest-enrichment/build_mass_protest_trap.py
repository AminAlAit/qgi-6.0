"""The mass-protest-trap derived feature (D4, mass_protest enrichment cycle).

Per `PRE-REGISTRATION.md` (committed 7cdfb5f) candidate #3 -- "BUILD FIRST (strictly lagged,
test-first, leakage-review) as the D4 control every repression/regime candidate must beat" --
the protest-trap (`prior_mass_protest_count` / `years_since_last_mass_protest`) is built FIRST,
as a blocking prerequisite, as a STRICTLY-LAGGED derived transform off
`data/shape_inputs_v2/mass_protest/positives.csv`. Only PRIOR years' mass-protest events may
inform year t -- the protest AT year t (the very outcome the model predicts) is never counted
as its own history, and no future protest may leak backward into an earlier year's feature
value.

Two features, per country x year:
  * `prior_mass_protest_count`      -- count of that country's mass-protest events with
                                        event_year < t.
  * `years_since_last_mass_protest` -- t - (most recent mass-protest event_year < t); a large
                                        `sentinel` (default 99.0, i.e. effectively "never")
                                        when there is no prior mass-protest event on record
                                        for that country.

This module is a direct structural port of
`experiments/military-coup-enrichment/build_coup_trap.py` (the D4 coup-trap, same cycle
methodology) onto `mass_protest`'s positives.csv -- same feature math, same panel-writer
convention, same leakage-test discipline. See that module's docstring for the DI-split
rationale (pure feature math + panel I/O here, host-testable with pandas/pyarrow only; no
joblib/xgboost/sklearn/scipy).

`normalize_country_id` / `COUNTRY_NAME_OVERRIDES` below are a VERBATIM copy of
`scripts/run_f_ml_1_poc.py`'s (that module is not host-importable without the full
joblib/xgboost/sklearn/scipy stack; see `test_build_mass_protest_trap.py`'s
`test_normalize_country_id_matches_real_panel_country_strings` for the parity guard against
the real panel data). This copy is deliberately NOT "fixed" or improved -- the protest-trap
panel must key on the IDENTICAL country strings the production walk's `samples["country"]`
column will carry (built via the same function).

`write_panels` writes parquet files in the exact `panel_dir/<indicator>/<indicator>.parquet`
layout `scripts/run_f_ml_1_poc.load_panel` expects (country: str, year: int32, value: float64,
provider: str) so the protest-trap panel is a drop-in indicator for `build_X_y` /
`fit_predict_loco`, identical to any other panel indicator -- no bespoke feature-extraction
path.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

DEFAULT_SENTINEL = 99.0  # "no prior mass-protest event on record" -- larger than any real gap
DEFAULT_YEAR_START = 1900
DEFAULT_YEAR_END = 2023
PROVIDER_TAG = "DERIVED_MASS_PROTEST_TRAP"

# --------------------------------------------------------------------------------------------
# VERBATIM copy of scripts/run_f_ml_1_poc.py's COUNTRY_NAME_OVERRIDES / normalize_country_id.
# See module docstring for why this is a copy, not an import.
# --------------------------------------------------------------------------------------------
COUNTRY_NAME_OVERRIDES: dict[str, str] = {
    "democratic_republic_of_congo": "The Democratic Republic of the Congo",
    "guinea_bissau": "Guinea-Bissau",
    "republic_of_congo": "Republic of the Congo",
    "timor_leste": "Timor-Leste",
}


def normalize_country_id(country_id: str) -> str:
    """Normalize a positives.csv `country_id` to canonical Title Case form matching parquet
    panels + `samples["country"]` (verbatim copy of run_f_ml_1_poc.normalize_country_id)."""
    if country_id in COUNTRY_NAME_OVERRIDES:
        return COUNTRY_NAME_OVERRIDES[country_id]
    return country_id.replace("_", " ").title()


# ============================================================================================
# Pure feature math.
# ============================================================================================
def prior_mass_protest_count(protest_years: list[int], year: int) -> int:
    """Count of `protest_years` strictly BEFORE `year`. A mass-protest event AT `year` itself
    is excluded -- it is the outcome, never its own history."""
    return sum(1 for y in protest_years if y < year)


def years_since_last_mass_protest(
    protest_years: list[int], year: int, sentinel: float = DEFAULT_SENTINEL
) -> float:
    """`year` minus the most recent mass-protest year strictly BEFORE `year`; `sentinel` if
    none. A mass-protest event AT `year` itself is excluded (see `prior_mass_protest_count`)."""
    prior = [y for y in protest_years if y < year]
    if not prior:
        return float(sentinel)
    return float(year - max(prior))


# ============================================================================================
# Positives loading (host-side; does not require the production walk module).
# ============================================================================================
def load_positives(positives_csv: str | Path) -> pd.DataFrame:
    """Load `positives.csv` (`country_id, event_year`) and normalize to the `country, year`
    schema the protest-trap builder + the production `samples` frame both use."""
    df = pd.read_csv(positives_csv)
    return pd.DataFrame(
        {
            "country": df["country_id"].apply(normalize_country_id),
            "year": df["event_year"].astype(int),
        }
    )


# ============================================================================================
# Panel builder -- the strictly-lagged derived transform, per (country, year) cell.
# ============================================================================================
def build_mass_protest_trap_frames(
    positives: pd.DataFrame,
    year_start: int = DEFAULT_YEAR_START,
    year_end: int = DEFAULT_YEAR_END,
    sentinel: float = DEFAULT_SENTINEL,
) -> dict[str, pd.DataFrame]:
    """Build the full (country x year) cartesian protest-trap panel for every country that
    appears in `positives` (already normalized: columns `country`, `year`), over
    `[year_start, year_end]` inclusive.

    Returns `{"prior_mass_protest_count": df, "years_since_last_mass_protest": df}`, each in
    the production panel schema (`country: str, year: int32, value: float64, provider: str`).

    Leakage-safety: for a given country, `prior_mass_protest_count(t)` /
    `years_since_last_mass_protest(t)` are pure functions of
    `{y in that country's protest_years : y < t}` only -- by construction they cannot depend
    on any protest at year >= t (see `test_build_mass_protest_trap.py`'s `test_leakage_*`
    tests for the explicit mutation/addition checks).
    """
    countries = sorted(positives["country"].unique())
    years = list(range(year_start, year_end + 1))

    protest_years_by_country: dict[str, list[int]] = {
        c: sorted(int(y) for y in positives.loc[positives["country"] == c, "year"])
        for c in countries
    }

    pmc_rows: list[dict] = []
    ysl_rows: list[dict] = []
    for country in countries:
        py = protest_years_by_country[country]
        for year in years:
            pmc_rows.append(
                {"country": country, "year": year,
                 "value": float(prior_mass_protest_count(py, year)),
                 "provider": PROVIDER_TAG}
            )
            ysl_rows.append(
                {"country": country, "year": year,
                 "value": years_since_last_mass_protest(py, year, sentinel=sentinel),
                 "provider": PROVIDER_TAG}
            )

    def _finalize(rows: list[dict]) -> pd.DataFrame:
        out = pd.DataFrame(rows)
        out["year"] = out["year"].astype("int32")
        out["value"] = out["value"].astype("float64")
        out["country"] = out["country"].astype(str)
        out["provider"] = out["provider"].astype(str)
        return out.reset_index(drop=True)

    return {
        "prior_mass_protest_count": _finalize(pmc_rows),
        "years_since_last_mass_protest": _finalize(ysl_rows),
    }


# ============================================================================================
# Panel writer -- production panel_dir layout.
# ============================================================================================
def write_panels(frames: dict[str, pd.DataFrame], out_dir: str | Path) -> list[Path]:
    """Write each `{name: df}` to `out_dir/<name>/<name>.parquet`, matching the layout
    `scripts/run_f_ml_1_poc.load_panel` reads (`panel_dir / indicator_id / f"{indicator_id}.parquet"`).
    Returns the list of written paths."""
    out_dir = Path(out_dir)
    written: list[Path] = []
    for name, df in frames.items():
        ind_dir = out_dir / name
        ind_dir.mkdir(parents=True, exist_ok=True)
        path = ind_dir / f"{name}.parquet"
        df.to_parquet(path, index=False)
        written.append(path)
    return written


# ============================================================================================
# CLI (host-runnable: only needs pandas + pyarrow, no ML stack).
# ============================================================================================
def main(argv: list[str] | None = None) -> int:
    here = Path(__file__).resolve().parent
    qgi_ml_root = here.parents[1]
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--positives-csv", type=Path,
        default=qgi_ml_root / "data" / "shape_inputs_v2" / "mass_protest" / "positives.csv",
    )
    ap.add_argument("--out-dir", type=Path, default=here / "mass_protest_trap_panel_dir")
    ap.add_argument("--year-start", type=int, default=DEFAULT_YEAR_START)
    ap.add_argument("--year-end", type=int, default=DEFAULT_YEAR_END)
    ap.add_argument("--sentinel", type=float, default=DEFAULT_SENTINEL)
    args = ap.parse_args(argv)

    pos = load_positives(args.positives_csv)
    frames = build_mass_protest_trap_frames(
        pos, year_start=args.year_start, year_end=args.year_end, sentinel=args.sentinel
    )
    written = write_panels(frames, args.out_dir)
    n_countries = pos["country"].nunique()
    print(
        f"[build_mass_protest_trap] {n_countries} countries, years [{args.year_start},{args.year_end}], "
        f"sentinel={args.sentinel} -> wrote {len(written)} panel(s) under {args.out_dir}"
    )
    for p in written:
        print(f"  {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
