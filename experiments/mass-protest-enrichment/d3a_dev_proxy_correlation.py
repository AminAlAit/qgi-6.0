"""D3a -- MANDATORY development-proxy correlation screen for the youth-bulge candidate
(mass_protest enrichment cycle).

Per `PRE-REGISTRATION.md` (committed 7cdfb5f) candidate #4 (`OWID_POP_YOUNG`): "development-proxy
risk -> mandatory D3a control = `NY.GNP.PCAP.CD` (specified), tested as level AND YoY
first-difference." Youth-bulge demography is a well-known confound for wealth/development level
(poorer countries skew structurally younger) -- if `OWID_POP_YOUNG` is really just GNI-per-capita
in disguise, any apparent mass_protest lift would be a development-proxy mirage (the same
confound class that killed banking-enrichment attempt #3, GII / development-level).

This is a SCREENING-STAGE correlation check (host-only, pandas + numpy, no Docker/ML stack) --
the cheap veto before any AUC test, per the method of record's S2 "residual-orthogonality
(|rho|<0.5 of the derived transform vs the existing drivers)" bar, applied here against the
specified dev-proxy control rather than against run-2's existing drivers. It is NOT the full
mandatory D3a "beat a bare GNI-per-capita fit through the production LOCO-AUC pipeline, CI
excluding zero" gate (that requires the Docker ML stack and only runs on candidates that
survive this screen; see `experiments/banking-enrichment/em_test/confound_income_proxy.py` for
that fuller pattern, reused verbatim if OWID_POP_YOUNG reaches AUC-testing).

Two representations are tested, per the pre-reg's explicit "level AND YoY first-difference":
  * LEVEL   -- Pearson r between OWID_POP_YOUNG(t-1) and NY.GNP.PCAP.CD(t-1), one row per
              positive event (t-1 = event_year - 1, strictly prior, no leakage).
  * YoY     -- Pearson r between the first-differences
              [OWID_POP_YOUNG(t-1) - OWID_POP_YOUNG(t-2)] and
              [NY.GNP.PCAP.CD(t-1) - NY.GNP.PCAP.CD(t-2)], same event set, complete-case on
              all four raw values.

A candidate REJECT_PROXY_CONFOUND if EITHER representation's |r| >= threshold (default 0.5,
the project's residual-orthogonality screening bar) -- either representation showing the
candidate moves in lockstep with national income is enough to flag the confound risk;
PASS_ORTHOGONAL only if BOTH representations clear the bar.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

DEFAULT_R_THRESHOLD = 0.5  # method-of-record S2 residual-orthogonality bar (|rho| < 0.5)
DEFAULT_MIN_N = 30

CANDIDATE_ID = "OWID_POP_YOUNG"
DEV_PROXY_ID = "NY.GNP.PCAP.CD"

# Verbatim copy of build_mass_protest_trap.normalize_country_id.
COUNTRY_NAME_OVERRIDES: dict[str, str] = {
    "democratic_republic_of_congo": "The Democratic Republic of the Congo",
    "guinea_bissau": "Guinea-Bissau",
    "republic_of_congo": "Republic of the Congo",
    "timor_leste": "Timor-Leste",
}


def normalize_country_id(country_id: str) -> str:
    if country_id in COUNTRY_NAME_OVERRIDES:
        return COUNTRY_NAME_OVERRIDES[country_id]
    return country_id.replace("_", " ").title()


# ============================================================================================
# Pure lookups.
# ============================================================================================
def value_at_year(panel: pd.DataFrame, country: str, year: int) -> float | None:
    """Exact (country, year) lookup into a panel DataFrame (`country`, `year`, `value`
    columns). None if no exact row exists (no fallback / no interpolation)."""
    hit = panel[(panel["country"] == country) & (panel["year"] == year)]
    if hit.empty:
        return None
    return float(hit["value"].iloc[0])


def pearson_r(x: np.ndarray, y: np.ndarray) -> float:
    """Pearson correlation coefficient, pure numpy. NaN if either series has zero variance
    (degenerate -- correlation undefined, never silently reported as 0)."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    if x.std() < 1e-12 or y.std() < 1e-12:
        return float("nan")
    return float(np.corrcoef(x, y)[0, 1])


# ============================================================================================
# Dataset assembly -- level (t-1) and YoY first-difference (t-1 minus t-2), complete-case.
# ============================================================================================
def build_level_dataset(
    positives: pd.DataFrame, candidate_panel: pd.DataFrame, proxy_panel: pd.DataFrame,
) -> pd.DataFrame:
    """One row per positive event with `candidate` = OWID_POP_YOUNG(t-1) and
    `proxy` = NY.GNP.PCAP.CD(t-1); complete-case (drop an event missing either value at t-1)."""
    rows: list[dict[str, Any]] = []
    for _, r in positives.iterrows():
        country, event_year = str(r["country"]), int(r["year"])
        t1 = event_year - 1
        cand_v = value_at_year(candidate_panel, country, t1)
        proxy_v = value_at_year(proxy_panel, country, t1)
        if cand_v is not None and proxy_v is not None:
            rows.append({"country": country, "event_year": event_year,
                         "candidate": cand_v, "proxy": proxy_v})
    return pd.DataFrame(rows, columns=["country", "event_year", "candidate", "proxy"])


def build_yoy_dataset(
    positives: pd.DataFrame, candidate_panel: pd.DataFrame, proxy_panel: pd.DataFrame,
) -> pd.DataFrame:
    """One row per positive event with `candidate_yoy` = OWID_POP_YOUNG(t-1) - (t-2) and
    `proxy_yoy` = NY.GNP.PCAP.CD(t-1) - (t-2); complete-case on all four raw values (t-1 and
    t-2 for both series). t-1/t-2 relative to the event year, strictly prior -- no leakage."""
    rows: list[dict[str, Any]] = []
    for _, r in positives.iterrows():
        country, event_year = str(r["country"]), int(r["year"])
        t1, t2 = event_year - 1, event_year - 2
        cand_t1 = value_at_year(candidate_panel, country, t1)
        cand_t2 = value_at_year(candidate_panel, country, t2)
        proxy_t1 = value_at_year(proxy_panel, country, t1)
        proxy_t2 = value_at_year(proxy_panel, country, t2)
        if None in (cand_t1, cand_t2, proxy_t1, proxy_t2):
            continue
        rows.append({
            "country": country, "event_year": event_year,
            "candidate_yoy": cand_t1 - cand_t2, "proxy_yoy": proxy_t1 - proxy_t2,
        })
    return pd.DataFrame(rows, columns=["country", "event_year", "candidate_yoy", "proxy_yoy"])


# ============================================================================================
# D3a verdict.
# ============================================================================================
def d3a_verdict(
    r_level: float, r_yoy: float, threshold: float = DEFAULT_R_THRESHOLD,
    n_level: int | None = None, n_yoy: int | None = None, min_n: int = DEFAULT_MIN_N,
) -> str:
    """`INSUFFICIENT_DATA` if either sample size is below `min_n`; else `REJECT_PROXY_CONFOUND`
    if EITHER |r_level| or |r_yoy| meets/exceeds `threshold`; else `PASS_ORTHOGONAL`."""
    if (n_level is not None and n_level < min_n) or (n_yoy is not None and n_yoy < min_n):
        return "INSUFFICIENT_DATA"
    if r_level != r_level or r_yoy != r_yoy:  # NaN guard (degenerate variance)
        return "INSUFFICIENT_DATA"
    if abs(r_level) >= threshold or abs(r_yoy) >= threshold:
        return "REJECT_PROXY_CONFOUND"
    return "PASS_ORTHOGONAL"


# ============================================================================================
# Orchestration (real panel data; host-only, no Docker).
# ============================================================================================
def _load_panel(panel_dir: Path, indicator_id: str) -> pd.DataFrame:
    return pd.read_parquet(panel_dir / indicator_id / f"{indicator_id}.parquet")


def _load_positives(positives_csv: Path) -> pd.DataFrame:
    df = pd.read_csv(positives_csv)
    return pd.DataFrame(
        {
            "country": df["country_id"].apply(normalize_country_id),
            "year": df["event_year"].astype(int),
        }
    )


def run_d3a(
    candidate_id: str = CANDIDATE_ID,
    proxy_id: str = DEV_PROXY_ID,
    panel_dir: Path | None = None,
    positives_csv: Path | None = None,
    threshold: float = DEFAULT_R_THRESHOLD,
    out_path: Path | None = None,
) -> dict[str, Any]:
    here = Path(__file__).resolve().parent
    qgi_ml_root = here.parents[1]
    panel_dir = panel_dir or (qgi_ml_root / "data" / "parquet_panels")
    positives_csv = positives_csv or (
        qgi_ml_root / "data" / "shape_inputs_v2" / "mass_protest" / "positives.csv"
    )
    positives = _load_positives(positives_csv)
    candidate_panel = _load_panel(panel_dir, candidate_id)
    proxy_panel = _load_panel(panel_dir, proxy_id)

    level_ds = build_level_dataset(positives, candidate_panel, proxy_panel)
    yoy_ds = build_yoy_dataset(positives, candidate_panel, proxy_panel)

    r_level = pearson_r(level_ds["candidate"], level_ds["proxy"]) if len(level_ds) else float("nan")
    r_yoy = pearson_r(yoy_ds["candidate_yoy"], yoy_ds["proxy_yoy"]) if len(yoy_ds) else float("nan")

    verdict = d3a_verdict(
        r_level, r_yoy, threshold=threshold,
        n_level=len(level_ds), n_yoy=len(yoy_ds),
    )

    out = {
        "candidate_id": candidate_id,
        "dev_proxy_id": proxy_id,
        "threshold": threshold,
        "n_pos_total": len(positives),
        "level": {"n_rows": len(level_ds), "r": r_level,
                  "coverage_at_positive_cells": len(level_ds) / len(positives) if len(positives) else 0.0},
        "yoy_first_diff": {"n_rows": len(yoy_ds), "r": r_yoy,
                            "coverage_at_positive_cells": len(yoy_ds) / len(positives) if len(positives) else 0.0},
        "verdict": verdict,
    }
    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[d3a_dev_proxy_correlation] wrote {out_path}")
    print(
        f"[d3a_dev_proxy_correlation] {candidate_id} vs {proxy_id}: "
        f"r_level={r_level:.4f} (n={len(level_ds)}) r_yoy={r_yoy:.4f} (n={len(yoy_ds)}) "
        f"verdict={verdict}"
    )
    return out


def main(argv: list[str] | None = None) -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--candidate-id", type=str, default=CANDIDATE_ID)
    ap.add_argument("--proxy-id", type=str, default=DEV_PROXY_ID)
    ap.add_argument("--panel-dir", type=Path, default=None)
    ap.add_argument("--positives-csv", type=Path, default=None)
    ap.add_argument("--threshold", type=float, default=DEFAULT_R_THRESHOLD)
    ap.add_argument("--out", type=Path, default=here / "results" / "d3a_dev_proxy_correlation_report.json")
    args = ap.parse_args(argv)
    run_d3a(
        candidate_id=args.candidate_id, proxy_id=args.proxy_id, panel_dir=args.panel_dir,
        positives_csv=args.positives_csv, threshold=args.threshold, out_path=args.out,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
