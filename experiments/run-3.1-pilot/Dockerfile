# run-3.1 pilot — pinned, minimal runtime image for the TE recipe walk +
# the offline selection-method pilot harness.
#
# ONE image for BOTH the local ~$0 pilot and the later gated AWS run-3.1
# walk (PRE-REGISTRATION.md §4 — "one pinned Docker image ... tie-break-drift
# guard"). Build once; run the whole 5-recipe pilot with run_pilot.sh.
#
# MINIMAL BY DESIGN: the image bakes ONLY the pinned Python runtime. The
# qgi-ml repo — code (scripts/, src/), data (data/parquet_panels ~248 indicator
# panels, data/shape_inputs_v2/*/positives.csv), and this experiment dir — is
# MOUNTED at run time, not copied in. The parquet panels are large and change
# out of band; baking them would bloat the image and defeat pilot<->AWS reuse.
#
# Build (context = this experiment dir, so COPY finds requirements-pinned.txt):
#   docker build -f experiments/run-3.1-pilot/Dockerfile \
#     -t qgi-run31-pilot:py313 experiments/run-3.1-pilot
#
# Run the full pilot (mount the qgi-ml repo read-write so results/ is written).
# From the qgi-ml repo root:
#   docker run --rm \
#     -v "$(pwd)":/work/qgi-ml \
#     -e GIT_COMMIT="$(git rev-parse HEAD)" \
#     qgi-run31-pilot:py313
#   # (default CMD runs experiments/run-3.1-pilot/run_pilot.sh; override RECIPES
#   #  with -e RECIPES="military_coup banking_and_financial_crisis" to subset.)

FROM python:3.13-slim

# --- Determinism: single-thread every BLAS / OpenMP backend so XGBoost and
#     numpy/scipy are bit-stable regardless of host core count
#     (walk lines 72-74; PRE-REG determinism clause). PYTHONHASHSEED pins any
#     hash-ordered iteration. ---
ENV OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1 \
    VECLIB_MAXIMUM_THREADS=1 \
    PYTHONHASHSEED=0 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# --- Pinned runtime. Every pin ships a manylinux cp313 wheel, so
#     --only-binary=:all: guarantees NO source compilation: no gcc/toolchain is
#     installed (keeps the slim image minimal) and a missing wheel fails the
#     build loudly instead of silently attempting a build it cannot complete. ---
COPY requirements-pinned.txt /tmp/requirements-pinned.txt
RUN python -m pip install --no-cache-dir --only-binary=:all: \
        -r /tmp/requirements-pinned.txt \
    && python -c "import numpy, scipy, pandas, sklearn, xgboost, pyarrow, yaml, joblib; \
print('deps OK numpy', numpy.__version__, 'xgboost', xgboost.__version__)"

# --- WORKDIR is the mounted qgi-ml repo root (the walk resolves REPO_ROOT from
#     its own file path, so cwd is not load-bearing for imports; run_pilot.sh
#     uses absolute paths derived from its own location). ---
WORKDIR /work/qgi-ml

# Default: run the whole pilot. Override the command to get an interactive
# shell (`docker run ... qgi-run31-pilot:py313 bash`). No ENTRYPOINT so the
# same image stays a generic pinned runner for the AWS walk too.
CMD ["bash", "experiments/run-3.1-pilot/run_pilot.sh"]
