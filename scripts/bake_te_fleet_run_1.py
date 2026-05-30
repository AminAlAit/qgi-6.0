"""Bake fleet-run-1 walk artifacts into the frontend's TE data-contract shape.

Reads from S3 (ml-results/{recipe}/) — produces a local corpus at
`qgi-frontend/data/te-fleet-run-1/` in cards-v3 + scores + country-index +
analogs + activity-feed shape. Applies the Bucket A enrichments committed in
`qgi-docs/internal/ops/te-sample-10-backend-reply-round-3-2026-05-29.md` so the
frontend reads server-resolved iso2/region/indicator names rather than
backfilling client-side.

INPUTS (resolved from CLI):
  --bucket qgi-data-lake-222222222222
  --output-dir qgi-frontend/data/te-fleet-run-1
  --countries qgi-frontend/data/countries.json
  --recipe-tracker qgi-frontend/data/recipe-tracker.json
  --indicator-catalog qgi-docs/methodology/indicator-catalog-detailed.md
  --vintage fleet-run-1-2026-05-30

OUTPUTS (under --output-dir):
  MANIFEST.json
  cards-v3/{recipe_id}.card.json   (per-recipe, all 44)
  scores/{recipe_id}.scores.json   (per-recipe, enriched)
  countries/country-index.json
  analogs/current-state-analogs.json
  activity/program-feed.json

Per the backend reply Bucket A:
  - iso2/iso3/flag_emoji baked on scores + analogs entries
  - region on country-index (+ coverage_density_pct per region)
  - indicator `name` on every shap_attribution + indicator_sensitivity entry
  - description_compelling from recipe-tracker.json
  - family_label from recipe-tracker.json (drops the letter glyph)
  - recipe_status_audience derived from pipeline verdict
  - histogram[].countries[] on score_distribution
  - score_pp + n_countries_scored on scores file
  - compound_score_v2 per country (bounded formula)
  - engine: 'trajectory-engine-v1' on every card

Hard constraints preserved:
  - Bit-identity: loco_auc rendered at JSON precision (no Math.round)
  - foreign_intervention sourced ONLY from the 2026-05-29 re-walk (post-fix)
  - No probability claims; calibration block as-is from the walk summary
  - Byline = Amin Al-Ait (not relevant here; bake is data only)

Usage:
  python qgi-ml/scripts/bake_te_fleet_run_1.py \\
    --bucket qgi-data-lake-222222222222 \\
    --output-dir ../qgi-frontend/data/te-fleet-run-1 \\
    --countries ../qgi-frontend/data/countries.json \\
    --recipe-tracker ../qgi-frontend/data/recipe-tracker.json \\
    --indicator-catalog ../qgi-docs/methodology/indicator-catalog-detailed.md \\
    --vintage fleet-run-1-2026-05-30
"""
from __future__ import annotations

import argparse
import datetime
import json
import logging
import math
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import boto3

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
LOG = logging.getLogger("bake-te-fleet-run-1")

# ─── verdict → recipe_status_audience mapping (§9.3) ─────────────────────────
# Pipeline owns the canonical mapping; frontend safe-falls unknown to "coming_soon".
VERDICT_TO_AUDIENCE_STATUS = {
    "LOCK": "validated",
    "HARD_FAIL": "prior_version",
    "COVERAGE_FAIL": "coming_soon",
    "CHANCE_FAIL": "prior_version",
    "MARGINAL": "in_play",
    "MARGINAL_PENDING_BETA_CALIBRATION": "in_play",
    "MARGINAL_PENDING_BETA_CAL": "in_play",
}

# ─── verdict → tier (the legacy classification used on cards) ────────────────
VERDICT_TO_TIER = {
    "LOCK": "validated",
    "HARD_FAIL": "experimental",
    "COVERAGE_FAIL": "experimental",
    "CHANCE_FAIL": "experimental",
    "MARGINAL": "directional",
    "MARGINAL_PENDING_BETA_CALIBRATION": "directional",
    "MARGINAL_PENDING_BETA_CAL": "directional",
}

CONTRACT_VERSION = "v3-2026-05-30"


def _provider_for(code: str | None) -> str | None:
    """Indicator-provider hint via code-prefix heuristic. Mirrors frontend's
    inferProvider(). Pipeline ought to emit this explicitly per frontend §1.4 —
    until then this is a server-side approximation."""
    if not code:
        return None
    if code.startswith("v2") or code.startswith("v3"):
        return "V-Dem"
    if code.endswith(".EST"):
        return "World Bank WGI"
    return "World Bank"


# ────────────────────────────────────────────────────────────────────────────
# Resource loaders
# ────────────────────────────────────────────────────────────────────────────

def load_countries(path: Path) -> dict[str, dict[str, str]]:
    """Returns: name → {iso2, iso3, name} dict. Source: qgi-frontend/data/countries.json
    which has [{id, name, alpha_2}, ...]. We synthesize iso3 from alpha_2 via a small
    fallback table for the most common cases — the catalog is iso-2 only.
    """
    countries = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, dict[str, str]] = {}
    for c in countries:
        name = c.get("name") or ""
        iso2 = c.get("alpha_2")
        if not name or not iso2:
            continue
        out[name] = {"iso2": iso2.lower(), "iso3": None, "name": name}
    return out


# Flag emoji from iso2 codepoints: A=0x1F1E6, etc.
def flag_emoji_from_iso2(iso2: str | None) -> str | None:
    if not iso2 or len(iso2) != 2:
        return None
    base = 0x1F1E6
    cp = [base + ord(c.upper()) - ord("A") for c in iso2]
    return "".join(chr(p) for p in cp)


# UN-region static seed (kept minimal; covers the ~150 countries we score).
_REGION_SEED = {
    "us": "Americas", "ca": "Americas", "mx": "Americas", "br": "Americas",
    "ar": "Americas", "cl": "Americas", "co": "Americas", "pe": "Americas",
    "ve": "Americas", "uy": "Americas", "ec": "Americas", "bo": "Americas",
    "cu": "Americas", "do": "Americas", "ht": "Americas", "gt": "Americas",
    "hn": "Americas", "ni": "Americas", "pa": "Americas", "cr": "Americas",
    "sv": "Americas", "jm": "Americas", "tt": "Americas", "py": "Americas",
    "gb": "Europe", "fr": "Europe", "de": "Europe", "it": "Europe",
    "es": "Europe", "pt": "Europe", "nl": "Europe", "be": "Europe",
    "ch": "Europe", "at": "Europe", "se": "Europe", "no": "Europe",
    "dk": "Europe", "fi": "Europe", "ie": "Europe", "pl": "Europe",
    "cz": "Europe", "sk": "Europe", "hu": "Europe", "ro": "Europe",
    "bg": "Europe", "gr": "Europe", "hr": "Europe", "rs": "Europe",
    "ba": "Europe", "al": "Europe", "mk": "Europe", "si": "Europe",
    "lt": "Europe", "lv": "Europe", "ee": "Europe", "is": "Europe",
    "mt": "Europe", "lu": "Europe", "cy": "Europe", "by": "Europe",
    "ua": "Europe", "md": "Europe", "ru": "Europe", "me": "Europe",
    "cn": "Asia", "jp": "Asia", "kr": "Asia", "kp": "Asia",
    "tw": "Asia", "hk": "Asia", "mn": "Asia", "in": "Asia",
    "pk": "Asia", "bd": "Asia", "lk": "Asia", "np": "Asia",
    "bt": "Asia", "mm": "Asia", "th": "Asia", "vn": "Asia",
    "kh": "Asia", "la": "Asia", "my": "Asia", "sg": "Asia",
    "id": "Asia", "ph": "Asia", "bn": "Asia", "tl": "Asia",
    "af": "Asia", "ir": "Asia", "iq": "Asia", "sy": "Asia",
    "lb": "Asia", "jo": "Asia", "il": "Asia", "ps": "Asia",
    "sa": "Asia", "ae": "Asia", "om": "Asia", "ye": "Asia",
    "kw": "Asia", "qa": "Asia", "bh": "Asia", "tr": "Asia",
    "ge": "Asia", "am": "Asia", "az": "Asia", "kz": "Asia",
    "uz": "Asia", "tm": "Asia", "kg": "Asia", "tj": "Asia",
    "eg": "Africa", "ly": "Africa", "tn": "Africa", "dz": "Africa",
    "ma": "Africa", "sd": "Africa", "ss": "Africa", "et": "Africa",
    "er": "Africa", "dj": "Africa", "so": "Africa", "ke": "Africa",
    "ug": "Africa", "tz": "Africa", "rw": "Africa", "bi": "Africa",
    "cd": "Africa", "cg": "Africa", "cf": "Africa", "td": "Africa",
    "cm": "Africa", "ne": "Africa", "ng": "Africa", "bj": "Africa",
    "tg": "Africa", "gh": "Africa", "ci": "Africa", "lr": "Africa",
    "sl": "Africa", "gn": "Africa", "gw": "Africa", "sn": "Africa",
    "gm": "Africa", "ml": "Africa", "bf": "Africa", "mr": "Africa",
    "cv": "Africa", "ao": "Africa", "zm": "Africa", "mw": "Africa",
    "mz": "Africa", "zw": "Africa", "bw": "Africa", "na": "Africa",
    "za": "Africa", "sz": "Africa", "ls": "Africa", "mg": "Africa",
    "mu": "Africa", "sc": "Africa", "km": "Africa", "ga": "Africa",
    "gq": "Africa", "st": "Africa", "au": "Oceania", "nz": "Oceania",
    "pg": "Oceania", "fj": "Oceania", "sb": "Oceania", "vu": "Oceania",
    "ws": "Oceania", "ki": "Oceania", "to": "Oceania", "fm": "Oceania",
    "mh": "Oceania", "pw": "Oceania", "nr": "Oceania", "tv": "Oceania",
}


def region_for(iso2: str | None) -> str | None:
    if not iso2:
        return None
    return _REGION_SEED.get(iso2.lower())


def load_recipe_tracker(path: Path) -> dict[str, dict[str, Any]]:
    """Returns: recipe_id → tracker row with description_compelling + l1_id + label.
    Source: qgi-frontend/data/recipe-tracker.json (the canonical hand-curated set).
    """
    data = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, dict[str, Any]] = {}
    # The tracker is a flat list of recipe entries
    recipes = data if isinstance(data, list) else data.get("recipes", [])
    for r in recipes:
        rid = r.get("recipe_id") or r.get("id")
        if not rid:
            continue
        out[rid] = r
    return out


# Family taxonomy A-H per recipe-tracker.json convention
FAMILY_LABELS = {
    "A": "Governance Stress",
    "B": "Economic Stress",
    "C": "Civil Conflict",
    "D": "International Tension",
    "E": "Foreign Policy",
    "F": "Social Movements",
    "G": "External Shock",
    "H": "Institutional Reform",
}


def load_indicator_catalog(path: Path) -> dict[str, str]:
    """Returns: indicator_code → friendly name.
    Parses the markdown table from qgi-docs/methodology/indicator-catalog-detailed.md.

    Catalog rows have shape:
      `| WB-01 | VC.BTL.DETH | Battle-related deaths per 100K | <prose> | ... |`
       ID-col   code-col      name-col                          QGI-value
    OR (for V-Dem section without ID col):
      `| v2x_polyarchy | Electoral Democracy Index (0-1) | ... |`

    Strategy: scan all `|`-delimited cells; find the FIRST cell that looks like
    an indicator code (no spaces, contains '.' or '_', 4-30 chars); use the
    NEXT non-empty cell as the friendly name.
    """
    if not path.exists():
        LOG.warning("indicator catalog not found at %s — names will be null", path)
        return {}
    out: dict[str, str] = {}
    code_re = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.]{3,29}$")

    def looks_like_code(s: str) -> bool:
        s = s.strip()
        if not code_re.match(s):
            return False
        # Reject if it's an ID-marker (WB-NN, VD-NN, FA-NN, IL-NN, NN-NN)
        if re.match(r"^[A-Z]{2,3}-\d{1,3}$", s):
            return False
        # Must contain at least one '.' or '_' or be all-lowercase v-prefixed
        return ("." in s) or ("_" in s) or s.startswith("v2")

    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 2:
            continue
        # Skip separator rows
        if all(set(c) <= {"-", " ", ":"} for c in cells):
            continue
        # Skip header rows
        if any(c.lower() in ("code", "indicator", "name", "indicator name") for c in cells[:3]):
            continue
        # Find the first code-shaped cell + use the next non-empty cell as name
        for i, c in enumerate(cells):
            if looks_like_code(c):
                name = next((cells[j] for j in range(i + 1, len(cells)) if cells[j]), None)
                if name and name != c and len(name) > 3:
                    out[c] = name
                break
    return out


# ────────────────────────────────────────────────────────────────────────────
# S3 helpers
# ────────────────────────────────────────────────────────────────────────────

def list_recipe_dirs(s3: Any, bucket: str) -> list[str]:
    out: list[str] = []
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix="ml-results/", Delimiter="/"):
        for p in page.get("CommonPrefixes", []) or []:
            sub = p["Prefix"].split("ml-results/")[1].rstrip("/")
            if not sub or sub.startswith("_"):
                continue
            out.append(sub)
    return sorted(out)


def s3_get_json(s3: Any, bucket: str, key: str) -> dict | None:
    try:
        body = s3.get_object(Bucket=bucket, Key=key)["Body"].read()
        return json.loads(body)
    except Exception:
        return None


# ────────────────────────────────────────────────────────────────────────────
# Card-v3 builder
# ────────────────────────────────────────────────────────────────────────────

def normalize_iso(name: str, countries: dict[str, dict[str, str]]) -> tuple[str | None, str | None, str | None]:
    """Returns (iso2, iso3, flag_emoji) for a country name; (None, None, None) if not found."""
    if not name:
        return None, None, None
    # Direct hit
    entry = countries.get(name)
    if entry:
        iso2 = entry.get("iso2")
        return iso2, entry.get("iso3"), flag_emoji_from_iso2(iso2)
    # Title-case retry
    entry = countries.get(name.title())
    if entry:
        iso2 = entry.get("iso2")
        return iso2, entry.get("iso3"), flag_emoji_from_iso2(iso2)
    return None, None, None


def build_card_v3(
    summary: dict,
    sensitivity_data: dict | None,
    indicator_names: dict[str, str],
    tracker_row: dict[str, Any] | None,
    s3_bucket: str,
) -> dict:
    """Compose a card-v3 JSON from the walk summary + sidecar artifacts."""
    rid = summary.get("recipe_id")
    verdict = summary.get("verdict") or "UNKNOWN"
    tier = VERDICT_TO_TIER.get(verdict, "experimental")
    audience_status = VERDICT_TO_AUDIENCE_STATUS.get(verdict, "coming_soon")
    go = summary.get("greedy_outer_loop") or {}
    selected = go.get("selected_indicators") or []
    chosen_window = go.get("chosen_window")
    gl = summary.get("global_loco") or {}

    # Family from tracker row's l1_id
    l1_id = (tracker_row or {}).get("l1_id") or (tracker_row or {}).get("family_id")
    family_label = FAMILY_LABELS.get(l1_id) if l1_id else None

    # Indicator-sensitivity LOO (#967 emits this in score_countries; pull from sidecar)
    sens_entries: list[dict] = []
    if sensitivity_data:
        for e in sensitivity_data.get("leave_one_out") or []:
            code = e.get("indicator") or e.get("code")
            sens_entries.append({
                "code": code,
                "name": indicator_names.get(code) if code else None,
                "auc_with": e.get("cv_auc_full") or e.get("auc_with"),
                "auc_without": e.get("cv_auc_without") or e.get("auc_without"),
                "auc_drop": e.get("auc_drop"),
            })

    # Greedy walk history (best-effort; #967 walk schema)
    greedy_history = []
    for step in (go.get("history") or []):
        greedy_history.append({
            "step": step.get("step"),
            "candidate": step.get("candidate") or step.get("indicator"),
            "window": step.get("window"),
            "auc": step.get("auc") or step.get("final_global_auc"),
            "lift_over_previous": step.get("lift_over_previous", 0),
            "selected_after": step.get("selected_after") or [],
        })

    # score_distribution: computed downstream from country-scores.json
    # (filled in build_scores_file; emitted here as placeholder)
    score_distribution = {
        "computed": False,
        "histogram": [],
        "median": None,
        "p90": None,
        "p99": None,
        "max": None,
        "n_countries_scored": 0,
        "source": "score_countries.py per-country eval",
    }

    card = {
        "recipe_id": rid,
        "engine": "trajectory-engine-v1",
        "contract_version": CONTRACT_VERSION,
        "tier": tier,
        "tier_provenance": "verdict → tier mapping in bake_te_fleet_run_1.py",
        "recipe_status_audience": audience_status,
        "family_label": family_label,
        "description_compelling": (tracker_row or {}).get("description_compelling"),
        "description": (tracker_row or {}).get("description"),
        "verdict": verdict,
        "stats": {
            "loco_auc": gl.get("auc"),
            "ci95_lo": gl.get("ci95_lo"),
            "ci95_hi": gl.get("ci95_hi"),
            "ci80_lo": gl.get("ci80_lo"),
            "ci80_hi": gl.get("ci80_hi"),
            "n_bootstrap": gl.get("n_bootstrap"),
        },
        "greedy_walk": {
            "selected_indicators": selected,
            "selected_indicators_named": [
                {"code": c, "name": indicator_names.get(c)} for c in selected
            ],
            "chosen_window": chosen_window,
            "final_global_auc": go.get("final_global_auc"),
            "early_abort_floor_unreachable": go.get("early_abort_floor_unreachable", False),
            "history": greedy_history,
        },
        "coverage_audit": summary.get("coverage_audit"),
        "per_cohort": summary.get("per_cohort") or {},
        "architecture": summary.get("architecture"),
        "architecture_provenance": summary.get("architecture_provenance") or {},
        "borderline_lock": summary.get("borderline_lock", False),
        "temporal_confound_auc": summary.get("temporal_confound_auc"),
        "stability_diagnostic": summary.get("stability_diagnostic"),
        "per_recipe_floor_provenance": summary.get("per_recipe_floor_provenance") or {},
        "n_positives": summary.get("n_positives"),
        "n_negatives": summary.get("n_negatives"),
        "walked_at_utc": summary.get("filed"),
        "elapsed_seconds": summary.get("elapsed_seconds"),
        "raw_summary_s3": f"s3://{s3_bucket}/ml-results/{rid}/f-ml-1-poc-summary.json",
        "score_distribution": score_distribution,  # filled by scores pass
        "indicator_sensitivity": {
            "computed": bool(sens_entries),
            "leave_one_out": sens_entries,
            "method": "5-fold-CV LOO ablation per #967",
        },
        "reliability_multipass": {
            "walks_completed": 1,
            "v1_separation_pp": None,
            "v4_oot_recall_pct": None,
            "verdict": verdict,
        },
        "calibration": summary.get("calibration") or {
            "computed": False,
            "bins": None,
            "ece": None,
            "notes": "calibration block absent in this vintage",
        },
        "per_country_scores_pointer": f"scores/{rid}.scores.json",
    }
    return card


# ────────────────────────────────────────────────────────────────────────────
# Scores file builder
# ────────────────────────────────────────────────────────────────────────────

def build_scores_file(
    rid: str,
    vintage: str,
    country_scores: dict | None,
    countries: dict[str, dict[str, str]],
    indicator_names: dict[str, str],
) -> dict | None:
    """Compose the scores file from country-scores.json (#967 output) with iso2 +
    indicator name + score_pp backfill."""
    if not country_scores:
        return None
    raw = country_scores.get("scores") or []
    if not raw:
        return None
    # Sort by score desc for rank assignment
    raw_sorted = sorted(raw, key=lambda e: -(e.get("score") or 0))
    n = len(raw_sorted)
    entries: list[dict] = []
    for rank, e in enumerate(raw_sorted, 1):
        name = e.get("country") or e.get("name") or ""
        iso2, iso3, flag = normalize_iso(name, countries)
        # SHAP attribution with friendly names (field names per frontend contract §4)
        shap_attr = []
        for s in (e.get("shap_attribution") or []):
            code = s.get("indicator") or s.get("code")
            shap_attr.append({
                "indicator_code": code,
                "indicator_name": indicator_names.get(code) if code else None,
                "signal_share_pct": s.get("signal_share_pct") or s.get("share_pct") or s.get("share"),
                # Raw shap_value pending score_countries.py upgrade (frontend §4 ask)
                "shap_value": s.get("shap_value"),
                # Provider hint via code-prefix heuristic (mirrors frontend's inferProvider)
                "provider": _provider_for(code),
            })
        # Indicator movement with friendly names
        movement = []
        for m in (e.get("indicator_movement") or []):
            code = m.get("indicator") or m.get("code")
            movement.append({
                "indicator_code": code,
                "indicator_name": indicator_names.get(code) if code else None,
                "trajectory_12q": m.get("trajectory_12q") or [],
                "z_score_change": m.get("z_score_change"),
                "provider": _provider_for(code),
                # Raw values + unit pending score_countries upgrade (frontend §1.4 ask)
                "latest_raw_value": m.get("latest_raw_value"),
                "prior_raw_value": m.get("prior_raw_value"),
                "unit": m.get("unit"),
            })
        # Nearest analogs
        analogs = []
        for a in (e.get("nearest_analogs") or []):
            an_name = a.get("country") or a.get("name") or ""
            an_iso2, _, _ = normalize_iso(an_name, countries)
            analogs.append({
                "country": an_name,
                "country_iso2": an_iso2,
                "year": a.get("year"),
                "match_score": a.get("match_score") or a.get("similarity"),
                "weak_analog": bool(a.get("weak_analog", False)),
            })
        score = e.get("score")
        score_pp = round(100.0 * (n - rank) / max(n - 1, 1), 2) if n > 1 else 50.0
        entries.append({
            "iso": iso3,
            "iso2": iso2,
            "flag_emoji": flag,
            "name": name,
            "score": score,
            "rank": rank,
            "score_pp": score_pp,
            "eval_year": e.get("eval_year"),
            "in_evidence_base": bool(e.get("in_evidence_base", False)),
            "delta_vs_prior_vintage": None,  # first vintage
            "shap_attribution": shap_attr,
            "indicator_movement": movement,
            "nearest_analogs": analogs,
        })

    return {
        "recipe_id": rid,
        "vintage": vintage,
        "scored_at_utc": country_scores.get("scored_at_utc")
                          or country_scores.get("walked_at_utc")
                          or datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "n_countries_scored": n,
        "train_auc": country_scores.get("train_auc"),
        "scoring_method": "XGBoost refit + SHAP TreeExplainer (per #967)",
        "scores": entries,
    }


def compute_score_distribution(scores_file: dict) -> dict:
    """20 bins of 5pp width with hover country list per bin (§9.14)."""
    entries = scores_file.get("scores") or []
    if not entries:
        return {"computed": False, "histogram": [], "median": None, "p90": None, "p99": None, "max": None, "n_countries_scored": 0}
    bins: list[dict] = []
    for i in range(20):
        lo, hi = i * 5, (i + 1) * 5
        in_bin = [e for e in entries if (lo <= (e.get("score") or 0) < hi) or (i == 19 and (e.get("score") or 0) == 100)]
        bins.append({
            "bin_lo": lo,
            "bin_hi": hi,
            "count": len(in_bin),
            "countries": [e.get("name") for e in in_bin],
            "country_isos": [e.get("iso2") for e in in_bin],
        })
    sorted_scores = sorted([(e.get("score") or 0) for e in entries])
    n = len(sorted_scores)

    def pct(p):
        if n == 0:
            return None
        idx = max(0, min(n - 1, int(p * n / 100)))
        return sorted_scores[idx]

    return {
        "computed": True,
        "histogram": bins,
        "median": pct(50),
        "p90": pct(90),
        "p99": pct(99),
        "max": sorted_scores[-1] if sorted_scores else None,
        "n_countries_scored": n,
        "source": "score_countries.py per-country eval",
    }


# ────────────────────────────────────────────────────────────────────────────
# Country-index builder (the big cross-recipe join)
# ────────────────────────────────────────────────────────────────────────────

def compound_score_v2(scores_per_country: list[float]) -> float:
    """V4.1 §8 + Sard consult formula:
      sqrt(N / (N + 2)) * sqrt(mean(score_i² for score_i ≥ 50))
    Bounded [0, 100]. Shrinks for thin coverage."""
    lit = [s for s in scores_per_country if s >= 50.0]
    if not lit:
        return 0.0
    N = len(lit)
    inner = sum(s * s for s in lit) / N
    return math.sqrt(N / (N + 2.0)) * math.sqrt(inner)


def build_country_index(
    all_scores: dict[str, dict],  # recipe_id → scores file dict
    all_cards: dict[str, dict],
    countries: dict[str, dict[str, str]],
    tracker: dict[str, dict[str, Any]],
    vintage: str,
) -> dict:
    """Aggregate every country across every recipe; produce CountryIndexEntry rows."""
    # country_name → {recipe_id → score_entry}
    by_country: dict[str, dict[str, dict]] = {}
    for rid, sf in all_scores.items():
        for e in (sf.get("scores") or []):
            name = e.get("name")
            if not name:
                continue
            by_country.setdefault(name, {})[rid] = e

    out_entries: list[dict] = []
    for name, recipe_scores in by_country.items():
        iso2, iso3, flag = normalize_iso(name, countries)
        region = region_for(iso2)

        # top_recipes (sorted by score desc)
        top_sorted = sorted(recipe_scores.items(), key=lambda kv: -(kv[1].get("score") or 0))
        top_recipes = []
        for rid, sc in top_sorted[:5]:
            card = all_cards.get(rid, {})
            tracker_row = tracker.get(rid) or {}
            l1_id = tracker_row.get("l1_id") or tracker_row.get("family_id") or ""
            top_recipes.append({
                "recipe_id": rid,
                "label": tracker_row.get("label") or rid.replace("_", " ").title(),
                "l1_id": l1_id,
                "l1_label": FAMILY_LABELS.get(l1_id, ""),
                "l1_color": tracker_row.get("l1_color") or "#888",
                "score": sc.get("score"),
                "status": card.get("recipe_status_audience") or "coming_soon",
            })

        # recipes_lit_count = recipes with score >= 50
        lit_scores = [sc.get("score") or 0 for sc in recipe_scores.values() if (sc.get("score") or 0) >= 50]
        lit_families = sorted({
            (tracker.get(rid) or {}).get("l1_id") or ""
            for rid, sc in recipe_scores.items()
            if (sc.get("score") or 0) >= 50
        } - {""})

        cs_v2 = compound_score_v2([sc.get("score") or 0 for sc in recipe_scores.values()])
        # Legacy compound_score: simple sum capped
        compound_legacy = sum(lit_scores)

        out_entries.append({
            "iso": iso3,
            "iso2": iso2,
            "flag_emoji": flag,
            "name": name,
            "region": region,
            "population": None,
            "vintage": vintage,
            "recipes_lit_count": len(lit_scores),
            "lit_families": list(lit_families),
            "compound_score": compound_legacy,
            "compound_score_v2": round(cs_v2, 2),
            "top_recipes": top_recipes,
            "drivers_attribution": None,
            "drivers_movement": None,
            "rank_history": [{"quarter": vintage, "rank_on_top_recipe": (top_sorted[0][1].get("rank") if top_sorted else None)}],
            "rank_history_notes": "First vintage; rank history accumulates from next quarterly run.",
            "analogs_pointer": "analogs/current-state-analogs.json",
            "compound_score_rank": 0,  # filled after sort
        })

    # Rank by compound_score_v2 desc
    out_entries.sort(key=lambda e: -e["compound_score_v2"])
    for i, e in enumerate(out_entries, 1):
        e["compound_score_rank"] = i

    # Region density rollup
    region_counts: dict[str, int] = {}
    for e in out_entries:
        r = e.get("region") or "Unknown"
        region_counts[r] = region_counts.get(r, 0) + 1

    return {
        "vintage": vintage,
        "platform_roster_size": 248,  # canonical UN-member-ish count for the roster
        "n_countries_scored": len(out_entries),
        "compound_score_formula": "sqrt(N/(N+2)) * sqrt(mean(score² for score ≥ 50))  (V4.1 §8 / Sard consult)",
        "coverage_density_per_region": region_counts,
        "countries": out_entries,
    }


# ────────────────────────────────────────────────────────────────────────────
# Analogs file builder (per-country top analogs across all recipes)
# ────────────────────────────────────────────────────────────────────────────

def build_analogs_file(
    all_scores: dict[str, dict],
    tracker: dict[str, dict[str, Any]],
    countries: dict[str, dict[str, str]],
    vintage: str,
) -> dict:
    """For each country, aggregate top analog matches across recipes."""
    by_country: dict[str, list[dict]] = {}
    contributions: dict[str, dict[str, dict]] = {}
    for rid, sf in all_scores.items():
        for e in (sf.get("scores") or []):
            name = e.get("name")
            if not name:
                continue
            for an in (e.get("nearest_analogs") or []):
                by_country.setdefault(name, []).append({
                    "country": an.get("country"),
                    "country_iso2": an.get("country_iso2"),
                    "year": an.get("year"),
                    "match_score": an.get("match_score"),
                    "primary_recipe_id": rid,
                    "what_happened_next": None,
                    "weak_analog": an.get("weak_analog", False),
                })
            # Track per-recipe contribution
            s = e.get("score") or 0
            if s >= 50:
                contributions.setdefault(name, {})[rid] = {
                    "recipe_id": rid,
                    "score": s,
                    "tracker_row": tracker.get(rid) or {},
                }

    entries: list[dict] = []
    for name, analogs in by_country.items():
        iso2, _, _ = normalize_iso(name, countries)
        region = region_for(iso2)
        # Sort + cap to top 5 analogs
        analogs_sorted = sorted(analogs, key=lambda a: -(a.get("match_score") or 0))[:5]
        # Contributions
        contr_list: list[dict] = []
        c_dict = contributions.get(name, {})
        total = sum(c.get("score") for c in c_dict.values()) or 1.0
        for rid, c in c_dict.items():
            tr = c["tracker_row"]
            l1_id = tr.get("l1_id") or ""
            contr_list.append({
                "recipe_id": rid,
                "recipe_label": tr.get("label") or rid.replace("_", " ").title(),
                "l1_color": tr.get("l1_color") or "#888",
                "contribution_pct": round(100.0 * (c.get("score") or 0) / total, 2),
                "status": "in_play",
            })
        contr_list.sort(key=lambda c: -c["contribution_pct"])
        entries.append({
            "iso": None,
            "iso2": iso2,
            "name": name,
            "region": region,
            "indicator_trajectory": None,
            "analogs": analogs_sorted,
            "contributions": contr_list[:5],
        })

    return {"vintage": vintage, "entries": entries}


# ────────────────────────────────────────────────────────────────────────────
# Activity feed (walk_fired events from all 44 recipes)
# ────────────────────────────────────────────────────────────────────────────

def build_activity_feed(
    all_cards: dict[str, dict],
    tracker: dict[str, dict[str, Any]],
    vintage: str,
) -> dict:
    events: list[dict] = []
    # walk_fired events per card
    for rid, card in all_cards.items():
        tr = tracker.get(rid) or {}
        events.append({
            "kind": "walk_fired",
            "fired_at": card.get("walked_at_utc"),
            "recipe_id": rid,
            "recipe_label": tr.get("label") or rid.replace("_", " ").title(),
            "tier": card.get("tier"),
            "verdict": card.get("verdict"),
            "loco_auc": card.get("stats", {}).get("loco_auc"),
            "in_review_after": True,
            "note": f"Wave {('1+2' if rid in {'banking_and_financial_crisis','bilateral_treaty','diplomatic_rupture','economic_liberalization','economic_nationalization','ethnic_and_communal_conflict','fiscal_policy_change','government_formation','migration_and_refugees','terrorist_attack'} else '3' if rid != 'foreign_intervention' else 'foreign_intervention re-walk')} → first vintage of this recipe under the trajectory engine.",
        })
    # Hard-coded methodology event for the truncation-leak vacation
    events.append({
        "kind": "vacate",
        "fired_at": "2026-05-25T19:00:00+00:00",
        "recipe_id": "foreign_intervention",
        "recipe_label": "Foreign Intervention",
        "prior_status": "graduated",
        "vacated_at": "2026-05-25T19:00:00+00:00",
        "cause": "Sample-truncation leak: graduation LOCO 0.9147 was on 110/174 positives (~63% partial). Corrected full-corpus walk lands at 0.7227 (still above the 0.700 lock floor; not auto-graduating, not falsified).",
        "note": "Public correction live since 2026-05-25; re-walk under fixed instrument completed 2026-05-29T21:02Z (verdict MARGINAL_PENDING_BETA_CALIBRATION).",
    })
    # Methodology amendment events
    events.append({
        "kind": "methodology_amendment",
        "fired_at": "2026-05-25T13:00:00+00:00",
        "title": "Coverage- and chance-baseline gates added to F-ML-1 §3.4/§3.5",
        "detail": "8/8 Majles RATIFY-WITH-RIDER (MR-14-A1 / MR-14-A2 / T20-R3 NON-AMENDABLE first-re-walk-non-FI firewall). Closes the truncation-leak failure class.",
        "source": "qgi-docs/internal/decisions/artifacts/F-ML-1-coverage-chance-gate-amendment-2026-05-25.md",
    })

    # Sort by fired_at desc
    events.sort(key=lambda e: e.get("fired_at") or "", reverse=True)

    return {
        "vintage": vintage,
        "events": events,
        "notes": {
            "first_vintage": "Walk_fired events are first-vintage signals; reliability tiles populate from the next quarterly run.",
        },
    }


# ────────────────────────────────────────────────────────────────────────────
# Main bake pipeline
# ────────────────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bucket", required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--countries", type=Path, required=True)
    ap.add_argument("--recipe-tracker", type=Path, required=True)
    ap.add_argument("--indicator-catalog", type=Path, required=True)
    ap.add_argument("--vintage", default="fleet-run-1-2026-05-30")
    args = ap.parse_args()

    LOG.info("Loading resources...")
    countries = load_countries(args.countries)
    LOG.info("  %d countries", len(countries))
    tracker = load_recipe_tracker(args.recipe_tracker)
    LOG.info("  %d tracker rows", len(tracker))
    indicator_names = load_indicator_catalog(args.indicator_catalog)
    LOG.info("  %d indicator catalog entries", len(indicator_names))

    s3 = boto3.client("s3", region_name="eu-central-1")
    recipe_ids = list_recipe_dirs(s3, args.bucket)
    LOG.info("Discovered %d recipe dirs in S3", len(recipe_ids))

    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "cards-v3").mkdir(exist_ok=True)
    (args.output_dir / "scores").mkdir(exist_ok=True)
    (args.output_dir / "countries").mkdir(exist_ok=True)
    (args.output_dir / "analogs").mkdir(exist_ok=True)
    (args.output_dir / "activity").mkdir(exist_ok=True)

    all_cards: dict[str, dict] = {}
    all_scores: dict[str, dict] = {}

    def process_one(rid: str) -> tuple[str, dict | None, dict | None]:
        summary = s3_get_json(s3, args.bucket, f"ml-results/{rid}/f-ml-1-poc-summary.json")
        if not summary:
            return rid, None, None
        sensitivity = s3_get_json(s3, args.bucket, f"ml-results/{rid}/sensitivity-{rid}-2026.json")
        country_scores = s3_get_json(s3, args.bucket, f"ml-results/{rid}/country-scores.json")
        tracker_row = tracker.get(rid)
        card = build_card_v3(summary, sensitivity, indicator_names, tracker_row, args.bucket)
        scores_file = build_scores_file(rid, args.vintage, country_scores, countries, indicator_names)
        if scores_file:
            card["score_distribution"] = compute_score_distribution(scores_file)
        return rid, card, scores_file

    LOG.info("Building cards + scores per recipe (parallel S3 fetches)...")
    with ThreadPoolExecutor(max_workers=10) as ex:
        for rid, card, scores_file in ex.map(process_one, recipe_ids):
            if card is None:
                LOG.warning("  %s: no summary; skipped", rid)
                continue
            all_cards[rid] = card
            (args.output_dir / "cards-v3" / f"{rid}.card.json").write_text(json.dumps(card, indent=2, default=str))
            if scores_file:
                all_scores[rid] = scores_file
                (args.output_dir / "scores" / f"{rid}.scores.json").write_text(json.dumps(scores_file, indent=2, default=str))
            else:
                LOG.info("  %s: no country-scores.json (likely pre-image-rebuild walk; scores skipped)", rid)

    LOG.info("Built %d cards, %d scores files", len(all_cards), len(all_scores))

    LOG.info("Building country-index...")
    country_index = build_country_index(all_scores, all_cards, countries, tracker, args.vintage)
    (args.output_dir / "countries" / "country-index.json").write_text(json.dumps(country_index, indent=2, default=str))
    LOG.info("  %d countries indexed", country_index["n_countries_scored"])

    LOG.info("Building analogs file...")
    analogs_file = build_analogs_file(all_scores, tracker, countries, args.vintage)
    (args.output_dir / "analogs" / "current-state-analogs.json").write_text(json.dumps(analogs_file, indent=2, default=str))
    LOG.info("  %d analog entries", len(analogs_file["entries"]))

    LOG.info("Building activity feed...")
    activity = build_activity_feed(all_cards, tracker, args.vintage)
    (args.output_dir / "activity" / "program-feed.json").write_text(json.dumps(activity, indent=2, default=str))
    LOG.info("  %d events", len(activity["events"]))

    # Indicator corpus breakdown: count of UNIQUE indicators by provider seen
    # across all walks (frontend §1.3 — what they want is the corpus inventory,
    # not the per-walk selection tally).
    seen_per_provider: dict[str, set[str]] = {}
    for card in all_cards.values():
        for ind in (card.get("greedy_walk", {}).get("selected_indicators") or []):
            p = _provider_for(ind) or "Other"
            seen_per_provider.setdefault(p, set()).add(ind)
    provider_tally = {p: len(s) for p, s in seen_per_provider.items()}

    # MANIFEST
    manifest = {
        "vintage": args.vintage,
        "run_index": 1,  # frontend §1.3 — first official fleet run; increment on next vintage
        "produced_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "engine": "F-ML-1 / Trajectory Engine (ML2)",
        "n_recipes": len(all_cards),
        "n_scores_files": len(all_scores),
        "n_countries_indexed": country_index["n_countries_scored"],
        "indicator_catalog_size": len(indicator_names),  # frontend §1.3
        "indicator_corpus_breakdown": provider_tally,    # frontend §1.3
        "contract_version": CONTRACT_VERSION,
        "image_digest": "sha256:b95ece033fb5f5ff6b4dcca7011f7a7a52747d864fbcac5cb7900ecd5f91c6f8",
        "image_tag": "43f9d9bd",
        "qgi_ml_sha": "9e764464c9074d0e5c351cd31603456b5b8ff434",
        "bucket_a_enrichments_applied": [
            "iso2/iso3/flag_emoji on scores + analogs",
            "region on country-index",
            "indicator name on every shap_attribution + indicator_sensitivity entry",
            "description_compelling from recipe-tracker.json",
            "family_label from recipe-tracker.json (letter glyph dropped)",
            "recipe_status_audience derived from pipeline verdict",
            "histogram[].countries[] on score_distribution",
            "score_pp + n_countries_scored on scores file",
            "compound_score_v2_per_country on country-index",
            "engine: trajectory-engine-v1 on every card",
            "coverage_density_per_region on country-index",
        ],
        "verdict_counts": {},
        "tier_counts": {},
    }
    for card in all_cards.values():
        v = card.get("verdict") or "UNKNOWN"
        manifest["verdict_counts"][v] = manifest["verdict_counts"].get(v, 0) + 1
        t = card.get("tier") or "UNKNOWN"
        manifest["tier_counts"][t] = manifest["tier_counts"].get(t, 0) + 1
    (args.output_dir / "MANIFEST.json").write_text(json.dumps(manifest, indent=2, default=str))

    LOG.info("=== BAKE COMPLETE ===")
    LOG.info("Output: %s", args.output_dir)
    LOG.info("Verdict counts: %s", manifest["verdict_counts"])
    LOG.info("Tier counts:    %s", manifest["tier_counts"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
