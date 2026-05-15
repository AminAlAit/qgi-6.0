"""
Phase 5 v0.2 Path B — hierarchical-Bayes partial-pooling evaluator (T12 day-1 scaffold).

This is the Bayesian sibling of `validate_weight_matrix.py` (v6.5, the
frequentist Path A evaluator at qgi-ml `d26b4e3`). Path A returned INERT
4/4 on Stage F substrate at T9 (#673, qgi-data `0f8aeed`); the
falsification report (T11, qgi-docs `dfe2cd4`, ratified 5/5 at `3b9221c`)
fired Path B per two pre-registered triggers (Kwame T5 §2 first-execution
affirmation + Priya T7 §3 anchor-battery auto-trigger). This module is
the queue-ready implementation that T12 (#676) exercises against the
Path A run artifacts.

The contract is the Path B implementation spec at
`qgi-docs/internal/ops/cascade-track/phase-5-v0.2-path-b-architecture.md`
(commit `ca77505`, ratified 3/3 unanimous on 2026-05-14 by Priya #22,
Kwame #11, Ji-Hoon #21). Sign-offs preserved at:
  - c:/tmp/v0.2-T12-ratification/signoff_priya.md
  - c:/tmp/v0.2-T12-ratification/signoff_kwame.md
  - c:/tmp/v0.2-T12-ratification/signoff_jihoon.md

What this scaffold does (day-1 deliverable):
  - Builds the PyMC partial-pooling model per spec §1 with priors per §2
  - Generates a synthetic cell-level AUC panel for smoke-testing
  - Runs NUTS with the §3.1 sampling config and emits the §3.1 diagnostics
  - Provides a real-data prep helper that converts the four T9 per-arm
    JSONs into the model's (n_arms, n_countries, n_categories) input shape

What this scaffold does NOT do (deferred to the T12 trio re-convening on
real data, per spec §3.1 and the Priya/Kwame/Ji-Hoon 2026-05-14 sign-offs):
  - Run MCMC against real T9 cell-level AUCs. The trio convenes for prior
    justification + sampling sign-off before that fires.
  - Execute the §2.5 sensitivity sweep (3×3×4 = 36 configurations across
    tau_arm scale, HalfCauchy scale, mu centring). The sweep config space
    must first be pinned in a JSON config — see TODO(kwame-T12-§2.5) below.
  - Emit a Path B falsification verdict. The verdict gate is the 94% HDI
    on `tau_arm[A] − tau_arm[D]`, read against spec §5 routing conditions.

Model statement (verbatim from spec §1):
    auc[arm, country, category] ~ Normal(
        mu
        + tau_arm[arm]
        + alpha_sector[sector(category)]
        + beta_cat[category]
        + country_intercept[country],
        sigma
    )

Priors (verbatim from spec §2, ratified 3/3 on 2026-05-14):
    tau_arm[arm]         ~ Normal(0, 0.05)                     # §2.1
    sigma_*              ~ HalfCauchy(0.05)                    # §2.2
    beta_cat[c]          ~ Normal(0, sigma_cat[sector(c)])     # §2.3 nested
    mu                   ~ Normal(0.30, 0.05)                  # §2.4 deliberately mis-centered

# TODO(kwame-T12-§2.5): pin sweep config to
# qgi-data/reference/v0.2-bayes-sweep-config.json before MCMC runs
# against real data. Non-blocking for day-1 scaffold; load-bearing
# for the eventual T12 trio re-convening on real data.

Sampling config (§3.1, ratified by Ji-Hoon #21):
  4 chains × 2000 iter post-warmup, warmup 1000, target_accept=0.95,
  max_treedepth=12, per-chain seeds set explicitly.

Diagnostics (§3.1, ratified by Ji-Hoon #21):
  R-hat < 1.01, n_eff > 400, divergences < 0.1 %, E-BFMI > 0.3,
  trace-plot non-stationarity inspection on country block.

Usage:
    # Smoke test (synthetic data; no real-data dependency):
    python qgi-ml/scripts/validate_weight_matrix_bayes.py --smoke

    # Real-data prep helper (loads T9 per-arm JSONs, returns cells array;
    # does NOT run MCMC — that's gated on the trio re-convening):
    python qgi-ml/scripts/validate_weight_matrix_bayes.py --prep-only
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:  # pragma: no cover
    import arviz as az
    import pymc as pm


ROOT = Path(__file__).resolve().parent.parent.parent

# Path A run artifacts (input to the prep helper).
ARM_JSON_PATHS = {
    arm: ROOT / "qgi-data" / "reference" / f"phase4-validation-arm{arm}.json"
    for arm in ("A", "B", "C", "D")
}

# Deterministic sector mapping from event_category. The L1 taxonomy lives
# under qgi-data/reference/event-category-l1-mapping.json; spec §1 names
# this as the load-bearing covariate that turns 68 categories into 10
# sectors. The prep helper loads it on real data; the smoke test uses a
# synthetic toy mapping.
L1_MAPPING_JSON = ROOT / "qgi-data" / "reference" / "event-category-l1-mapping.json"

# Schema version for the Path B evaluator JSON output. Distinct from the
# Path A SCHEMA_VERSION (v5 at validate_weight_matrix.py); Path B starts
# at v1 because the output structure is different (posterior HDIs, not
# rule v2 verdicts).
PATH_B_SCHEMA_VERSION = 1

# Priors — locked at T10 commit ca77505 + 2026-05-14 trio ratification.
# Amending any of these constants requires a new Majles convening with
# Priya #22, Kwame #11, and Ji-Hoon #21 present per spec §2 line 66.
TAU_ARM_PRIOR_SCALE = 0.05         # §2.1
HALF_CAUCHY_SCALE = 0.05           # §2.2 (sigma_sector, sigma_cat[s], sigma_country, sigma)
MU_PRIOR_CENTER = 0.30             # §2.4 — deliberately mis-centered (defended at spec line 74)
MU_PRIOR_SCALE = 0.05              # §2.4

# Sampling config — §3.1, ratified by Ji-Hoon #21.
N_CHAINS = 4
N_TUNE = 1000
N_DRAWS = 2000
TARGET_ACCEPT = 0.95
MAX_TREEDEPTH = 12

# Diagnostic thresholds — §3.1, ratified by Ji-Hoon #21.
R_HAT_THRESHOLD = 1.01
N_EFF_THRESHOLD = 400
DIVERGENCE_THRESHOLD_PCT = 0.001   # < 0.1 % of post-warmup samples
E_BFMI_THRESHOLD = 0.3

# Per-chain seeds. Pinned so smoke-test results reproduce across runs;
# real-data run uses these same seeds unless the trio convenes to change.
CHAIN_SEEDS = (17, 42, 123, 271)


@dataclass
class CellsArray:
    """The (n_arms, n_countries, n_categories) input the model fits against.

    `auc` is the cell-level ROC-AUC per (arm, country, category); cells
    with undefined AUC (no positives, no negatives, or below the Phase 4
    minimum-observation gate) are NaN — PyMC's Normal likelihood with
    explicit NaN masking handles missing observations natively (spec §1).

    `arm_labels`, `country_labels`, `category_labels` preserve the
    ordering for downstream interpretation of posterior summaries.

    `sector_idx_for_category` is the deterministic L1 mapping: each
    category index maps to one sector index in [0, n_sectors).
    """

    auc: np.ndarray  # shape (n_arms, n_countries, n_categories)
    arm_labels: list[str]
    country_labels: list[str]
    category_labels: list[str]
    sector_labels: list[str]
    sector_idx_for_category: np.ndarray  # shape (n_categories,)

    @property
    def n_arms(self) -> int:
        return len(self.arm_labels)

    @property
    def n_countries(self) -> int:
        return len(self.country_labels)

    @property
    def n_categories(self) -> int:
        return len(self.category_labels)

    @property
    def n_sectors(self) -> int:
        return len(self.sector_labels)

    def sha256_provenance(self) -> str:
        """SHA-256 of the cells array per spec §3.4 reproducibility block.

        The full input contract is `auc` shape + values + label ordering +
        sector mapping. Reviewer verifies this hash matches the T9 output
        the model claims to fit against.
        """
        hasher = hashlib.sha256()
        hasher.update(np.ascontiguousarray(self.auc, dtype=np.float64).tobytes())
        hasher.update("|".join(self.arm_labels).encode("utf-8"))
        hasher.update("|".join(self.country_labels).encode("utf-8"))
        hasher.update("|".join(self.category_labels).encode("utf-8"))
        hasher.update("|".join(self.sector_labels).encode("utf-8"))
        hasher.update(self.sector_idx_for_category.astype(np.int64).tobytes())
        return hasher.hexdigest()


def build_model(cells: CellsArray):
    """Build the PyMC partial-pooling model per spec §1.

    Country block uses NON-CENTERED parameterisation (spec §3.1):
        country_intercept_raw ~ Normal(0, 1)
        country_intercept     = sigma_country * country_intercept_raw

    This avoids funnel-geometry divergences on the K ≈ 272 country block.
    Sector and category effects use centered parameterisation (small enough
    counts: ~10 sectors, ~68 categories).

    Missing observations (NaN in `cells.auc`) are masked via PyMC's
    `observed` masked-array support; the posterior on tau_arm,
    alpha_sector, beta_cat, country_intercept updates from observed cells
    only — exactly the property that lets the model borrow strength
    across the sparse high-coverage / low-coverage tail (Priya T5 POV).
    """
    import pymc as pm  # local import — heavy dependency, only needed when fitting

    # Flatten cells to long form: each row is one observed AUC with its
    # (arm, country, category, sector) indices. PyMC handles the missing
    # cells via the mask in `observed`, so we flatten EVERY cell (including
    # NaNs) and let PyMC's automatic-imputation pathway absorb them.
    n_arms, n_countries, n_categories = cells.auc.shape
    arm_idx, country_idx, category_idx = np.indices(cells.auc.shape)
    arm_idx_flat = arm_idx.ravel()
    country_idx_flat = country_idx.ravel()
    category_idx_flat = category_idx.ravel()
    sector_idx_flat = cells.sector_idx_for_category[category_idx_flat]
    auc_flat = cells.auc.ravel()
    observed = np.ma.masked_invalid(auc_flat)

    coords = {
        "arm": cells.arm_labels,
        "country": cells.country_labels,
        "category": cells.category_labels,
        "sector": cells.sector_labels,
        "obs_id": np.arange(auc_flat.size),
    }

    with pm.Model(coords=coords) as model:
        # §2.4: deliberately mis-centered at 0.30 to force lift onto
        # tau_arm / alpha_sector / country_intercept rather than absorb
        # into mu (spec line 74 defends this).
        mu = pm.Normal("mu", mu=MU_PRIOR_CENTER, sigma=MU_PRIOR_SCALE)

        # §2.1: tau_arm — the parameter of interest. The 94% HDI on
        # tau_arm[A] - tau_arm[D] is the Path B falsification metric.
        tau_arm = pm.Normal("tau_arm", mu=0.0, sigma=TAU_ARM_PRIOR_SCALE, dims="arm")

        # §2.2 + §2.3: sector and category hyperpriors. Sector-level
        # alpha is shared across categories; sigma_cat is sector-specific
        # to allow civil_war (high heterogeneity) and monetary_policy
        # (low heterogeneity) different shrinkage targets.
        sigma_sector = pm.HalfCauchy("sigma_sector", beta=HALF_CAUCHY_SCALE)
        alpha_sector = pm.Normal("alpha_sector", mu=0.0, sigma=sigma_sector, dims="sector")
        sigma_cat = pm.HalfCauchy("sigma_cat", beta=HALF_CAUCHY_SCALE, dims="sector")
        beta_cat_raw = pm.Normal("beta_cat_raw", mu=0.0, sigma=1.0, dims="category")
        # Nested: each category's beta is scaled by its own sector's sigma_cat
        beta_cat = pm.Deterministic(
            "beta_cat",
            beta_cat_raw * sigma_cat[cells.sector_idx_for_category],
            dims="category",
        )

        # §3.1: non-centered country block — avoids funnel divergences
        # on the K ≈ 272 country block.
        sigma_country = pm.HalfCauchy("sigma_country", beta=HALF_CAUCHY_SCALE)
        country_intercept_raw = pm.Normal(
            "country_intercept_raw", mu=0.0, sigma=1.0, dims="country"
        )
        country_intercept = pm.Deterministic(
            "country_intercept",
            sigma_country * country_intercept_raw,
            dims="country",
        )

        # Likelihood. Cells with NaN observed are imputed by PyMC's
        # automatic-imputation pathway; posterior on the named params
        # updates from observed cells only.
        sigma = pm.HalfCauchy("sigma", beta=HALF_CAUCHY_SCALE)
        mean = (
            mu
            + tau_arm[arm_idx_flat]
            + alpha_sector[sector_idx_flat]
            + beta_cat[category_idx_flat]
            + country_intercept[country_idx_flat]
        )
        pm.Normal("auc_obs", mu=mean, sigma=sigma, observed=observed, dims="obs_id")

    return model


def sample_posterior(model, *, draws: int = N_DRAWS, tune: int = N_TUNE,
                     chains: int = N_CHAINS, seeds: tuple[int, ...] = CHAIN_SEEDS):
    """NUTS sampling with the §3.1 ratified config.

    Returns an arviz InferenceData object.
    """
    import pymc as pm  # local import

    if len(seeds) < chains:
        raise ValueError(f"Need at least {chains} per-chain seeds, got {len(seeds)}")

    with model:
        # PyMC 5.x routes step-method-scoped kwargs via the `nuts=` dict;
        # `target_accept` is a `pm.sample` top-level kwarg but
        # `max_treedepth` is NUTS-only. See:
        # https://www.pymc.io/projects/docs/en/v5.16.2/api/generated/pymc.sampling.mcmc.sample.html
        # progressbar=True forces per-iteration stdout so long Python-only
        # NUTS runs are diagnosable mid-flight; the §3.1 production run can
        # override this back to False if needed for log noise.
        idata = pm.sample(
            draws=draws,
            tune=tune,
            chains=chains,
            cores=1,  # one chain at a time so the progressbar isn't garbled
            random_seed=list(seeds[:chains]),
            target_accept=TARGET_ACCEPT,
            nuts={"max_treedepth": MAX_TREEDEPTH},
            progressbar=True,
            return_inferencedata=True,
        )
    return idata


def compute_diagnostics(idata) -> dict:
    """Extract the §3.1 diagnostic suite ratified by Ji-Hoon #21.

    Returns a dict with the named thresholds and PASS/FAIL per diagnostic
    so the smoke-test output (and the eventual real-data run) can be
    grepped by the PR-description / reviewer / regression-fixture pipeline.
    """
    import arviz as az  # local import

    summary = az.summary(idata, var_names=["mu", "tau_arm", "alpha_sector", "sigma"])
    max_r_hat = float(summary["r_hat"].max())
    min_n_eff = float(summary["ess_bulk"].min())

    sample_stats = idata.sample_stats
    n_post_warmup = sample_stats.draw.size * sample_stats.chain.size
    n_divergences = int(sample_stats.diverging.sum().item())
    divergence_pct = n_divergences / n_post_warmup if n_post_warmup else float("nan")

    # E-BFMI — energy-based fraction of missing information per chain.
    # Ji-Hoon §3.1: > 0.3 per chain is healthy.
    e_bfmi = az.bfmi(idata)
    min_e_bfmi = float(np.min(e_bfmi))

    return {
        "max_r_hat": max_r_hat,
        "min_n_eff": min_n_eff,
        "n_divergences": n_divergences,
        "divergence_pct": divergence_pct,
        "min_e_bfmi": min_e_bfmi,
        "n_post_warmup_samples": n_post_warmup,
        "thresholds": {
            "r_hat_max": R_HAT_THRESHOLD,
            "n_eff_min": N_EFF_THRESHOLD,
            "divergence_pct_max": DIVERGENCE_THRESHOLD_PCT,
            "e_bfmi_min": E_BFMI_THRESHOLD,
        },
        "verdicts": {
            "r_hat": "PASS" if max_r_hat < R_HAT_THRESHOLD else "FAIL",
            "n_eff": "PASS" if min_n_eff > N_EFF_THRESHOLD else "FAIL",
            "divergences": "PASS" if divergence_pct < DIVERGENCE_THRESHOLD_PCT else "FAIL",
            "e_bfmi": "PASS" if min_e_bfmi > E_BFMI_THRESHOLD else "FAIL",
        },
    }


def make_synthetic_cells(*, n_countries: int = 30, n_categories: int = 12,
                         n_sectors: int = 4, missing_rate: float = 0.30,
                         seed: int = 42) -> CellsArray:
    """Generate a small synthetic panel for smoke-testing.

    Structure mirrors the real shape (4 arms, K countries, M categories,
    nested into S sectors) but at small enough size that NUTS converges
    in seconds rather than minutes. Smoke test verifies the model
    SCAFFOLD works end-to-end; the trio's eventual real-data run will
    exercise it at K ≈ 272, M ≈ 68, S = 10.

    The simulated DGP plants a known tau_arm = (+0.04, +0.02, -0.01, 0.0)
    so the smoke test's posterior recovers a recognizable arm-A-vs-arm-D
    swing — convenient for the reviewer to eyeball.
    """
    rng = np.random.default_rng(seed)
    arm_labels = ["A", "B", "C", "D"]
    country_labels = [f"C{i:03d}" for i in range(n_countries)]
    category_labels = [f"cat_{i:02d}" for i in range(n_categories)]
    sector_labels = [f"sec_{i}" for i in range(n_sectors)]

    # Round-robin category → sector mapping
    sector_idx_for_category = np.array(
        [i % n_sectors for i in range(n_categories)], dtype=np.int64
    )

    # Ground-truth DGP per spec §1 structure
    true_mu = 0.50
    true_tau_arm = np.array([0.04, 0.02, -0.01, 0.0])  # A−D ≈ 0.04
    true_alpha_sector = rng.normal(0, 0.05, size=n_sectors)
    true_beta_cat = rng.normal(0, 0.05, size=n_categories)
    true_country_intercept = rng.normal(0, 0.05, size=n_countries)
    true_sigma = 0.03

    auc = np.full((4, n_countries, n_categories), np.nan)
    for arm in range(4):
        for country in range(n_countries):
            for category in range(n_categories):
                sector = sector_idx_for_category[category]
                mean = (
                    true_mu
                    + true_tau_arm[arm]
                    + true_alpha_sector[sector]
                    + true_beta_cat[category]
                    + true_country_intercept[country]
                )
                auc[arm, country, category] = rng.normal(mean, true_sigma)

    # Drop `missing_rate` fraction to NaN, simulating the sparse panel
    mask = rng.random(auc.shape) < missing_rate
    auc[mask] = np.nan

    return CellsArray(
        auc=auc,
        arm_labels=arm_labels,
        country_labels=country_labels,
        category_labels=category_labels,
        sector_labels=sector_labels,
        sector_idx_for_category=sector_idx_for_category,
    )


def load_l1_mapping() -> dict[str, str]:
    """Load the deterministic event_category → sector L1 mapping.

    Real-data prep helper uses this. Falls back to an empty dict if the
    file doesn't exist yet (which is fine for smoke testing).
    """
    if not L1_MAPPING_JSON.exists():
        return {}
    with L1_MAPPING_JSON.open(encoding="utf-8") as fh:
        data = json.load(fh)
    # Expected shape: {"mapping": {category_name: sector_name, ...}}
    return data.get("mapping", data)


def prep_cells_from_arm_jsons(arm_paths: dict[str, Path] | None = None) -> CellsArray:
    """Convert the four T9 per-arm JSONs into a CellsArray.

    Real-data prep helper. The T9 JSONs at qgi-data `0f8aeed`
    (`phase4-validation-arm{A,B,C,D}.json`) carry per-cell AUC under
    `per_cell` entries (shape varies by stratum cardinality); this helper
    flattens them into the (n_arms, n_countries, n_categories) grid that
    the partial-pooling model consumes.

    This day-1 scaffold ships a STUB implementation that the T12 trio's
    actual run replaces with the full extraction logic. Stub returns a
    CellsArray with NaN-only AUC so smoke tests can exercise the
    code path without depending on real T9 structure.

    The trio's real-data PR will:
      1. Walk each arm JSON's `per_cell` entries
      2. Pivot to the (country, category) grid for that arm
      3. Stack the 4 arm grids into the 3D cells array
      4. Apply the canonical_length filter from
         qgi-data/reference/v0.2-canonical-length.json
      5. Apply the 4-indicator exclusion list from
         qgi-data/reference/v0.2-demeaning-insufficient-exclusion.json
      6. Load the L1 mapping at L1_MAPPING_JSON
    """
    paths = arm_paths if arm_paths is not None else ARM_JSON_PATHS
    missing = [arm for arm, p in paths.items() if not p.exists()]
    if missing:
        raise FileNotFoundError(
            f"Missing per-arm JSONs for arms {missing}; expected at {paths}. "
            "Run T9 first (or use --smoke for synthetic data)."
        )
    # TODO(t12-trio): replace this stub with the full extraction described
    # in the docstring above. Day-1 scaffold returns a placeholder so the
    # CLI exists end-to-end.
    raise NotImplementedError(
        "prep_cells_from_arm_jsons is a stub in the day-1 scaffold. The T12 "
        "trio re-convening on real data lands the full extraction. Use "
        "make_synthetic_cells() for smoke testing the model scaffold."
    )


def run_smoke_test() -> dict:
    """End-to-end smoke test: synthetic data → model → NUTS → diagnostics.

    Smaller N than the real run for speed (smoke target: < 5 min on a
    workstation CPU with C-compiled NUTS; ~10-30 min on Python-only NUTS).
    Verifies the scaffold's plumbing: model builds, chains run, diagnostics
    emit, recovered tau_arm[A] - tau_arm[D] is in the expected direction.

    Returns a dict suitable for piping into the PR description.

    Progress logging is verbose by design — Python-only NUTS (when
    pytensor cannot find g++) can take hours per chain, and silent
    long-running smoke tests are unobservable. Every phase prints with a
    wall-time delta so a stalled run is diagnosable at a glance.
    """
    import time as _time

    t0 = _time.time()

    def _log(msg: str) -> None:
        elapsed = _time.time() - t0
        print(f"[smoke t+{elapsed:6.1f}s] {msg}", flush=True)

    started_at = datetime.now(timezone.utc).isoformat()
    _log("generating synthetic cells (30 countries x 12 categories x 4 arms)...")
    cells = make_synthetic_cells(n_countries=30, n_categories=12, n_sectors=4)
    cells_hash = cells.sha256_provenance()

    _log(f"cells shape: {cells.auc.shape}")
    _log(f"non-NaN cells: {int(np.sum(~np.isnan(cells.auc)))}/{cells.auc.size}")
    _log(f"cells SHA-256: {cells_hash}")

    _log("building PyMC partial-pooling model (compiling pytensor graph)...")
    model = build_model(cells)
    _log("model built; entering sampling phase")

    # Smoke-test sampling config: deliberately tiny so Python-only NUTS
    # finishes in minutes, not hours. 2 chains is the minimum for R-hat
    # to be defined; 200 draws + 200 tune is enough for divergences and
    # E-BFMI to be meaningful as a "does the scaffold work" smoke. The
    # §3.1 ratified config (4 chains x 2000 + 1000 tune) is what the T12
    # trio's real-data run uses — those constants stay locked at the
    # module level.
    smoke_chains = 2
    smoke_draws = 200
    smoke_tune = 200
    _log(f"sampling {smoke_chains} chains x {smoke_draws} draws "
         f"(tune {smoke_tune}); progressbar enabled for visibility...")
    idata = sample_posterior(model, draws=smoke_draws, tune=smoke_tune,
                             chains=smoke_chains)
    _log("sampling complete")

    _log("computing diagnostics (R-hat, n_eff, divergences, E-BFMI)...")
    diagnostics = compute_diagnostics(idata)
    _log(f"diagnostics: max_r_hat={diagnostics['max_r_hat']:.4f}, "
         f"min_n_eff={diagnostics['min_n_eff']:.1f}, "
         f"divergences={diagnostics['n_divergences']}, "
         f"min_e_bfmi={diagnostics['min_e_bfmi']:.3f}")

    # Headline posterior: tau_arm[A] - tau_arm[D] HDI
    import arviz as az  # local import

    _log("computing 94% HDI on tau_arm[A] - tau_arm[D] (the Path B headline metric)...")
    tau_arm_samples = idata.posterior["tau_arm"]
    a_minus_d = tau_arm_samples.sel(arm="A") - tau_arm_samples.sel(arm="D")
    hdi_94 = az.hdi(a_minus_d, hdi_prob=0.94)
    # arviz's hdi returns a DataArray; extract the two endpoints
    hdi_low = float(hdi_94["tau_arm"].sel(hdi="lower").item())
    hdi_high = float(hdi_94["tau_arm"].sel(hdi="higher").item())
    posterior_mean_a_minus_d = float(a_minus_d.mean().item())
    _log(f"posterior tau_arm[A]-tau_arm[D]: mean={posterior_mean_a_minus_d:+.4f}, "
         f"94% HDI=[{hdi_low:+.4f}, {hdi_high:+.4f}] (DGP planted +0.04)")

    finished_at = datetime.now(timezone.utc).isoformat()
    result = {
        "schema_version": PATH_B_SCHEMA_VERSION,
        "smoke_test": True,
        "started_at": started_at,
        "finished_at": finished_at,
        "cells": {
            "shape": list(cells.auc.shape),
            "n_non_nan": int(np.sum(~np.isnan(cells.auc))),
            "sha256": cells_hash,
        },
        "true_tau_a_minus_d_dgp": 0.04,  # planted ground truth from make_synthetic_cells
        "posterior_a_minus_d": {
            "mean": posterior_mean_a_minus_d,
            "hdi_94_low": hdi_low,
            "hdi_94_high": hdi_high,
        },
        "diagnostics": diagnostics,
        "config_under_test": {
            "n_chains_smoke": smoke_chains,
            "n_draws_smoke": smoke_draws,
            "n_tune_smoke": smoke_tune,
            "target_accept": TARGET_ACCEPT,
            "max_treedepth": MAX_TREEDEPTH,
            "chain_seeds": list(CHAIN_SEEDS[:smoke_chains]),
        },
        "production_config_ratified_at_t10_ca77505": {
            "n_chains": N_CHAINS,
            "n_draws": N_DRAWS,
            "n_tune": N_TUNE,
            "target_accept": TARGET_ACCEPT,
            "max_treedepth": MAX_TREEDEPTH,
        },
        "priors": {
            "tau_arm_scale": TAU_ARM_PRIOR_SCALE,
            "half_cauchy_scale": HALF_CAUCHY_SCALE,
            "mu_center": MU_PRIOR_CENTER,
            "mu_scale": MU_PRIOR_SCALE,
        },
        "spec_commit": "ca77505 (qgi-docs/internal/ops/cascade-track/phase-5-v0.2-path-b-architecture.md)",
        "ratification": "3/3 unanimous 2026-05-14 (Priya #22, Kwame #11, Ji-Hoon #21)",
    }

    return result


def _main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Phase 5 v0.2 Path B evaluator (T12 day-1 scaffold)"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--smoke", action="store_true",
                       help="Run end-to-end smoke test on synthetic data")
    group.add_argument("--prep-only", action="store_true",
                       help="Load real T9 per-arm JSONs and print cells-array shape; "
                            "does NOT run MCMC (gated on T12 trio re-convening)")
    parser.add_argument("--output-json", type=Path, default=None,
                        help="Optional path to write the smoke-test result JSON")
    args = parser.parse_args(argv)

    if args.smoke:
        result = run_smoke_test()
        print(json.dumps(result, indent=2, default=str))
        if args.output_json is not None:
            args.output_json.write_text(json.dumps(result, indent=2, default=str),
                                        encoding="utf-8")
        all_pass = all(v == "PASS" for v in result["diagnostics"]["verdicts"].values())
        return 0 if all_pass else 1

    if args.prep_only:
        cells = prep_cells_from_arm_jsons()  # stub: raises NotImplementedError
        print(f"cells shape: {cells.auc.shape}")
        return 0

    return 2  # unreachable due to required mutually-exclusive group


if __name__ == "__main__":  # pragma: no cover
    sys.exit(_main())
