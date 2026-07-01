#!/usr/bin/env bash
# =============================================================================
# run-3.1 pilot orchestrator
# -----------------------------------------------------------------------------
# Runs the whole offline, ~$0 selection-method pilot INSIDE the pinned container
# (experiments/run-3.1-pilot/Dockerfile). Everything is local; NO AWS spend.
#
# Per recipe, in order:
#   1. stability_select.py  --arm run31       (NEW: dedup -> top40 -> greedy, stability wrapper)
#   2. stability_select.py  --arm run3method  (OLD: plain greedy -> top40 -> greedy, stability wrapper)
#   3. baseline.py          (run-2 recorded set, same canonical samples/folds)
# After ALL recipes:
#   4. score_pilot.py       (reads every per-recipe JSON + criteria.yaml)
#
# All artifacts land in $RESULTS_DIR under the FROZEN INTER-MODULE CONTRACT:
#   {recipe}.run31.json   {recipe}.run3method.json   {recipe}.run2.json
#   PILOT-REPORT.md       report.json
#
# -----------------------------------------------------------------------------
# EXPECTED MODULE CLI CONTRACT (this orchestrator IS the coordination point;
# the sibling modules conform to these flags — they mirror the walk's own
# argparse names: --recipe-id / --panel-dir / --positives-csv):
#
#   stability_select.py --recipe-id <id> --arm <run31|run3method> \
#       --panel-dir <dir> --positives-csv <csv> --out-dir <dir> \
#       --seed-base <int> --git-commit <sha>
#       -> writes  <out-dir>/<id>.<arm>.json
#
#   baseline.py --recipe-id <id> \
#       --panel-dir <dir> --positives-csv <csv> --results-dir <dir> \
#       --git-commit <sha>
#       -> writes  <results-dir>/<id>.run2.json
#       (baseline also accepts --recipe / --out-dir aliases for the above.)
#
#   score_pilot.py --results-dir <dir> --criteria <criteria.yaml>
#       -> writes  <results-dir>/PILOT-REPORT.md  and  <results-dir>/report.json
#
# -----------------------------------------------------------------------------
# Overridable via environment (defaults resolve relative to this script):
#   RECIPES       space-separated recipe ids (default = the 5 pilot recipes;
#                 control civil_war first)
#   ARMS          stability arms to run   (default "run31 run3method")
#   PANEL_DIR     parquet panels dir      (default <repo>/data/parquet_panels)
#   POSITIVES_DIR shape_inputs_v2 dir     (default <repo>/data/shape_inputs_v2)
#   RESULTS_DIR   output dir              (default <pilot>/results)
#   CRITERIA      criteria.yaml path      (default <pilot>/criteria.yaml)
#   SEED_BASE     deterministic seed base (default 12345)
#   GIT_COMMIT    provenance stamp        (default UNKNOWN; do NOT run git here)
#   PYTHON        interpreter             (default python)
#   RUN_SCORE     run score_pilot at end  (default 1; set 0 to skip)
# =============================================================================
set -euo pipefail

# --- Locate self + repo (absolute; cwd-independent) --------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"   # experiments/run-3.1-pilot -> qgi-ml

PILOT_DIR="${SCRIPT_DIR}"
PANEL_DIR="${PANEL_DIR:-${REPO_ROOT}/data/parquet_panels}"
POSITIVES_DIR="${POSITIVES_DIR:-${REPO_ROOT}/data/shape_inputs_v2}"
RESULTS_DIR="${RESULTS_DIR:-${PILOT_DIR}/results}"
CRITERIA="${CRITERIA:-${PILOT_DIR}/criteria.yaml}"
SEED_BASE="${SEED_BASE:-12345}"
GIT_COMMIT="${GIT_COMMIT:-UNKNOWN}"
PYTHON="${PYTHON:-python}"
RUN_SCORE="${RUN_SCORE:-1}"

STABILITY="${PILOT_DIR}/stability_select.py"
BASELINE="${PILOT_DIR}/baseline.py"
SCORE="${PILOT_DIR}/score_pilot.py"

RECIPES="${RECIPES:-civil_war_and_insurgency executive_power_consolidation military_coup banking_and_financial_crisis territorial_disputes}"
ARMS="${ARMS:-run31 run3method}"

# --- Determinism (reinforce the Dockerfile ENV in case run outside container) -
export OMP_NUM_THREADS="${OMP_NUM_THREADS:-1}"
export OPENBLAS_NUM_THREADS="${OPENBLAS_NUM_THREADS:-1}"
export MKL_NUM_THREADS="${MKL_NUM_THREADS:-1}"
export NUMEXPR_NUM_THREADS="${NUMEXPR_NUM_THREADS:-1}"
export VECLIB_MAXIMUM_THREADS="${VECLIB_MAXIMUM_THREADS:-1}"
export PYTHONHASHSEED="${PYTHONHASHSEED:-0}"

log() { printf '%s [run-3.1] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "FATAL: $*" >&2; exit 1; }

# --- Preflight: fail fast with a clear message ------------------------------
[ -d "${PANEL_DIR}" ]     || die "panel dir not found: ${PANEL_DIR}"
[ -d "${POSITIVES_DIR}" ] || die "positives dir not found: ${POSITIVES_DIR}"
[ -f "${CRITERIA}" ]      || die "criteria.yaml not found: ${CRITERIA}"
[ -f "${STABILITY}" ]     || die "stability_select.py not found: ${STABILITY} (sibling agent output)"
[ -f "${BASELINE}" ]      || die "baseline.py not found: ${BASELINE} (sibling agent output)"
if [ "${RUN_SCORE}" = "1" ]; then
  [ -f "${SCORE}" ]       || die "score_pilot.py not found: ${SCORE} (sibling agent output)"
fi
command -v "${PYTHON}" >/dev/null 2>&1 || die "python interpreter not found: ${PYTHON}"

mkdir -p "${RESULTS_DIR}"

log "repo        = ${REPO_ROOT}"
log "panels      = ${PANEL_DIR}"
log "positives   = ${POSITIVES_DIR}"
log "results     = ${RESULTS_DIR}"
log "criteria    = ${CRITERIA}"
log "seed_base   = ${SEED_BASE}   git_commit = ${GIT_COMMIT}"
log "recipes     = ${RECIPES}"
log "arms        = ${ARMS}"
log "python      = $(${PYTHON} --version 2>&1)"
log "threads     = OMP=${OMP_NUM_THREADS} OPENBLAS=${OPENBLAS_NUM_THREADS} (deterministic)"

# --- Per-recipe: stability arms then run-2 baseline --------------------------
for recipe in ${RECIPES}; do
  positives="${POSITIVES_DIR}/${recipe}/positives.csv"
  [ -f "${positives}" ] || die "positives.csv not found for ${recipe}: ${positives}"

  for arm in ${ARMS}; do
    log ">>> ${recipe} | stability_select arm=${arm}"
    "${PYTHON}" "${STABILITY}" \
      --recipe-id   "${recipe}" \
      --arm         "${arm}" \
      --panel-dir   "${PANEL_DIR}" \
      --positives-csv "${positives}" \
      --out-dir     "${RESULTS_DIR}" \
      --seed-base   "${SEED_BASE}" \
      --git-commit  "${GIT_COMMIT}"
    log "<<< ${recipe} | arm=${arm} done -> ${RESULTS_DIR}/${recipe}.${arm}.json"
  done

  log ">>> ${recipe} | baseline arm=run2"
  "${PYTHON}" "${BASELINE}" \
    --recipe-id   "${recipe}" \
    --panel-dir   "${PANEL_DIR}" \
    --positives-csv "${positives}" \
    --results-dir "${RESULTS_DIR}" \
    --git-commit  "${GIT_COMMIT}"
  log "<<< ${recipe} | baseline done -> ${RESULTS_DIR}/${recipe}.run2.json"
done

# --- Score: read all per-recipe JSON + criteria.yaml -> report ---------------
if [ "${RUN_SCORE}" = "1" ]; then
  log ">>> score_pilot (all recipes + criteria.yaml)"
  "${PYTHON}" "${SCORE}" \
    --results-dir "${RESULTS_DIR}" \
    --criteria    "${CRITERIA}"
  log "<<< score_pilot done -> ${RESULTS_DIR}/PILOT-REPORT.md , ${RESULTS_DIR}/report.json"
else
  log "RUN_SCORE=0 -> skipping score_pilot"
fi

log "ALL DONE. Artifacts in ${RESULTS_DIR}"
