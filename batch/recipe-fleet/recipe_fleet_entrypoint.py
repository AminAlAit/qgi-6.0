"""Recipe-fleet Batch entrypoint.

Runs the F-ML-1 walk (run_f_ml_1_poc.py) + 5 in-walk capability scripts for
a batch of recipes sequentially inside a single Batch job. Designed for AWS
Batch EC2 Spot / Graviton (arm64, 2 vCPU / 4 GB).

Design doc: qgi-docs/internal/ops/ml-track/aws-recipe-fleet-design.md §7

Behaviour
---------
1. Sync indicator parquet panels from S3 ONCE (shared by all recipes in batch).
2. For each recipe_id in RECIPE_IDS (comma-separated env var):
   a. Skip if greedy-result.json already exists in S3 (resume-aware).
   b. Sync any existing checkpoint blobs from S3 for this recipe.
   c. Run run_f_ml_1_poc.py with --checkpoint-dir pointing to a per-recipe
      local dir (checkpoints/{recipe_id}/).
   d. Run the 5 in-walk capability scripts on the walk artifacts.
   e. Upload results + checkpoints to S3.
3. In canary mode (RUN_MODE=canary): write the SFN task token (if present in
   env) to S3 and emit cpu_utilization_pct_mean_walk + wall_clock_seconds +
   estimated_cost_usd to the result JSON.

Environment variables (all have defaults for local testing)
------------------------------------------------------------
S3_BUCKET              : str  — data lake bucket name
PARQUET_DATA_PREFIX    : str  — S3 prefix for indicator parquet panels
ML_RESULTS_PREFIX      : str  — S3 prefix for per-recipe result JSONs
ML_CHECKPOINTS_PREFIX  : str  — S3 prefix for per-recipe checkpoint blobs
RECIPE_MANIFEST_S3_KEY : str  — S3 key for recipe-manifest.json
RECIPE_IDS             : str  — comma-separated list of recipe_ids to run
RUN_MODE               : str  — "canary" or "fleet" (default "fleet")
SFN_TASK_TOKEN         : str  — optional; if set, written to S3 for the
                                approval-gate waitForTaskToken flow

S3 path conventions (trailing-slash prefixes):
  Parquet panels  : s3://{bucket}/{PARQUET_DATA_PREFIX}
  Results         : s3://{bucket}/{ML_RESULTS_PREFIX}{recipe_id}-result.json
  Checkpoints     : s3://{bucket}/{ML_CHECKPOINTS_PREFIX}{recipe_id}/
  Task token      : s3://{bucket}/{ML_RESULTS_PREFIX}canary-task-token-{recipe_id}.txt

NO Athena calls anywhere in this script — design §3 / §6 hard constraint.
"""
from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

import boto3
import psutil

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    stream=sys.stdout,
)
LOG = logging.getLogger("recipe-fleet-entrypoint")

# ---------------------------------------------------------------------------
# Environment / configuration
# ---------------------------------------------------------------------------
S3_BUCKET = os.environ.get("S3_BUCKET", "")
PARQUET_DATA_PREFIX = os.environ.get(
    "PARQUET_DATA_PREFIX",
    "pipeline-A-indicator-extractor/output/parquet-completed/",
)
ML_RESULTS_PREFIX = os.environ.get("ML_RESULTS_PREFIX", "ml-results/")
ML_CHECKPOINTS_PREFIX = os.environ.get("ML_CHECKPOINTS_PREFIX", "ml-checkpoints/")
RECIPE_MANIFEST_S3_KEY = os.environ.get(
    "RECIPE_MANIFEST_S3_KEY", "ml-results/recipe-manifest.json"
)
RECIPE_IDS_RAW = os.environ.get("RECIPE_IDS", "")
RUN_MODE = os.environ.get("RUN_MODE", "fleet")
SFN_TASK_TOKEN = os.environ.get("SFN_TASK_TOKEN", "")

# ---------------------------------------------------------------------------
# Path constants (container layout; see Dockerfile)
# ---------------------------------------------------------------------------
APP_DIR = Path("/app")
SCRIPTS_DIR = APP_DIR / "scripts"
# run_f_ml_1_poc.py expects to be invoked from the qgi-ml repo root
# context, which inside the container is /app (PYTHONPATH covers /app/scripts,
# /app/src). We pass explicit --output-dir so it writes locally.


def _s3() -> Any:
    return boto3.client("s3", region_name=os.environ.get("AWS_REGION", "eu-central-1"))


# ---------------------------------------------------------------------------
# S3 helpers (no Athena)
# ---------------------------------------------------------------------------

def s3_object_exists(bucket: str, key: str) -> bool:
    try:
        _s3().head_object(Bucket=bucket, Key=key)
        return True
    except _s3().exceptions.ClientError:
        return False
    except Exception:  # noqa: BLE001
        return False


def s3_sync_prefix_down(bucket: str, prefix: str, local_dir: Path) -> int:
    """Download all objects under S3 prefix into local_dir. Returns count."""
    local_dir.mkdir(parents=True, exist_ok=True)
    s3 = _s3()
    paginator = s3.get_paginator("list_objects_v2")
    count = 0
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            # Relative path within the prefix
            rel = key[len(prefix):]
            if not rel:
                continue
            dest = local_dir / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            s3.download_file(bucket, key, str(dest))
            count += 1
    LOG.info("s3_sync_down: %d objects from s3://%s/%s → %s", count, bucket, prefix, local_dir)
    return count


def s3_sync_dir_up(local_dir: Path, bucket: str, prefix: str) -> int:
    """Upload all files under local_dir to S3 prefix. Returns count."""
    s3 = _s3()
    count = 0
    for path in local_dir.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(local_dir)
        key = f"{prefix}{rel.as_posix()}"
        s3.upload_file(str(path), bucket, key)
        count += 1
    LOG.info("s3_sync_up: %d files from %s → s3://%s/%s", count, local_dir, bucket, prefix)
    return count


def s3_upload_json(data: dict, bucket: str, key: str) -> None:
    _s3().put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(data, indent=2).encode(),
        ContentType="application/json",
    )
    LOG.info("Uploaded JSON → s3://%s/%s", bucket, key)


def s3_put_text(text: str, bucket: str, key: str) -> None:
    _s3().put_object(Bucket=bucket, Key=key, Body=text.encode())
    LOG.info("Uploaded text → s3://%s/%s", bucket, key)


# ---------------------------------------------------------------------------
# CPU utilization sampler (canary metric — design §4 + §2a)
# ---------------------------------------------------------------------------

class CpuSampler:
    """Background CPU% sampler using psutil. Start before walk, stop after."""

    def __init__(self, interval: float = 5.0):
        self._interval = interval
        self._samples: list[float] = []
        self._running = False
        self._thread = None

    def start(self) -> None:
        import threading

        psutil.cpu_percent(interval=None)  # prime the counter
        self._running = True

        def _sample():
            while self._running:
                self._samples.append(psutil.cpu_percent(interval=self._interval))

        self._thread = threading.Thread(target=_sample, daemon=True)
        self._thread.start()

    def stop(self) -> float:
        """Stop sampling; return mean CPU% (0–100)."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=self._interval * 2)
        if not self._samples:
            return 0.0
        return sum(self._samples) / len(self._samples)


# ---------------------------------------------------------------------------
# Walk runner
# ---------------------------------------------------------------------------

def run_walk(
    recipe_id: str,
    local_data_dir: Path,
    local_output_dir: Path,
    local_checkpoint_dir: Path,
) -> dict:
    """Invoke run_f_ml_1_poc.py as a subprocess.

    Returns a dict with at minimum {"status": "ok" | "error", ...}.

    The script writes its output JSON into local_output_dir / run_{recipe_id}/.
    We pass --output-dir explicitly.
    """
    script = SCRIPTS_DIR / "run_f_ml_1_poc.py"
    if not script.exists():
        # Fallback: look in /app directly
        script = APP_DIR / "run_f_ml_1_poc.py"

    recipe_output_dir = local_output_dir / f"run_{recipe_id}"
    recipe_output_dir.mkdir(parents=True, exist_ok=True)

    # NB (AWS-expert review 2026-05-24): run_f_ml_1_poc.py's real flags are
    # --output-dir / --panel-dir / --positives-csv. There is NO --checkpoint-dir
    # or --data-dir; the #91 checkpoint (greedy-checkpoint.json + greedy-result
    # .json) is written into --output-dir, so the per-recipe output dir IS the
    # checkpoint+result location (and is what we sync to S3 for resume).
    cmd = [
        sys.executable,
        str(script),
        "--recipe-id", recipe_id,
        "--output-dir", str(recipe_output_dir),
        # Panel parquet synced from S3 into local_data_dir.
        "--panel-dir", str(local_data_dir),
    ]

    LOG.info("Launching walk: %s", " ".join(cmd))
    t0 = time.monotonic()
    try:
        result = subprocess.run(
            cmd,
            capture_output=False,  # stdout/stderr stream to CloudWatch via awslogs
            check=True,
            timeout=32 * 3600,  # 32 h hard cap per recipe (below Batch 36 h limit)
        )
        elapsed = time.monotonic() - t0
        LOG.info("Walk complete for %s in %.0f s", recipe_id, elapsed)
        return {"status": "ok", "wall_clock_seconds": elapsed}
    except subprocess.CalledProcessError as exc:
        elapsed = time.monotonic() - t0
        LOG.error("Walk FAILED for %s after %.0f s: returncode=%d", recipe_id, elapsed, exc.returncode)
        return {"status": "error", "returncode": exc.returncode, "wall_clock_seconds": elapsed}
    except subprocess.TimeoutExpired:
        elapsed = time.monotonic() - t0
        LOG.error("Walk TIMED OUT for %s after %.0f s", recipe_id, elapsed)
        return {"status": "timeout", "wall_clock_seconds": elapsed}


def run_capability_scripts(
    recipe_id: str,
    walk_output_dir: Path,
    local_data_dir: Path,
) -> dict:
    """Run the 5 in-walk capability scripts on the walk artifacts.

    Scripts (design §5):
      compute_track_record.py
      compute_nearest_analog.py
      compute_momentum.py
      compute_driver.py
      compute_sensitivity.py

    Returns a dict of {script_name: "ok"|"error"}.
    """
    capability_scripts = [
        "compute_track_record.py",
        "compute_nearest_analog.py",
        "compute_momentum.py",
        "compute_driver.py",
        "compute_sensitivity.py",
    ]
    results: dict[str, str] = {}
    for script_name in capability_scripts:
        script = SCRIPTS_DIR / script_name
        if not script.exists():
            script = APP_DIR / script_name
        if not script.exists():
            LOG.warning("Capability script not found: %s — skipping", script_name)
            results[script_name] = "not_found"
            continue
        cmd = [
            sys.executable,
            str(script),
            "--recipe-id", recipe_id,
            "--walk-output-dir", str(walk_output_dir),
            "--data-dir", str(local_data_dir),
        ]
        LOG.info("Running capability: %s", script_name)
        try:
            subprocess.run(cmd, check=True, timeout=1800)  # 30 min cap per script
            results[script_name] = "ok"
        except Exception as exc:  # noqa: BLE001
            LOG.error("Capability script %s failed: %s", script_name, exc)
            results[script_name] = "error"
    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if not S3_BUCKET:
        LOG.error("S3_BUCKET env var is required")
        sys.exit(1)

    recipe_ids = [r.strip() for r in RECIPE_IDS_RAW.split(",") if r.strip()]
    if not recipe_ids:
        LOG.error("RECIPE_IDS env var is empty or not set")
        sys.exit(1)

    LOG.info(
        "recipe-fleet-entrypoint starting | mode=%s | recipes=%s | bucket=%s",
        RUN_MODE, recipe_ids, S3_BUCKET,
    )

    with tempfile.TemporaryDirectory(prefix="qgi-fleet-") as tmpdir_str:
        tmpdir = Path(tmpdir_str)
        local_data_dir = tmpdir / "parquet-data"
        local_output_dir = tmpdir / "walk-output"
        local_checkpoints_root = tmpdir / "checkpoints"
        local_output_dir.mkdir(parents=True, exist_ok=True)

        # ------------------------------------------------------------------
        # Step 1: sync indicator parquet panels ONCE for all recipes.
        # ------------------------------------------------------------------
        LOG.info("Syncing parquet panels from s3://%s/%s ...", S3_BUCKET, PARQUET_DATA_PREFIX)
        n_parquet = s3_sync_prefix_down(S3_BUCKET, PARQUET_DATA_PREFIX, local_data_dir)
        LOG.info("Parquet sync complete: %d objects", n_parquet)

        # ------------------------------------------------------------------
        # If task token present (canary mode), write it to S3 immediately
        # so it's available even if the walk crashes.
        # ------------------------------------------------------------------
        if SFN_TASK_TOKEN and recipe_ids:
            token_key = f"{ML_RESULTS_PREFIX}canary-task-token-{recipe_ids[0]}.txt"
            s3_put_text(SFN_TASK_TOKEN, S3_BUCKET, token_key)
            LOG.info("SFN task token written to s3://%s/%s", S3_BUCKET, token_key)

        # ------------------------------------------------------------------
        # Step 2: process each recipe in the batch.
        # ------------------------------------------------------------------
        cpu_sampler = CpuSampler(interval=5.0)
        cpu_sampler.start()
        fleet_start = time.monotonic()

        job_summary: list[dict] = []

        for recipe_id in recipe_ids:
            result_key = f"{ML_RESULTS_PREFIX}{recipe_id}-result.json"

            # -- Resume guard: skip if greedy-result.json already in S3 --
            greedy_result_key = f"{ML_RESULTS_PREFIX}{recipe_id}-greedy-result.json"
            if s3_object_exists(S3_BUCKET, greedy_result_key):
                LOG.info("SKIP %s — greedy-result.json already in S3", recipe_id)
                job_summary.append({"recipe_id": recipe_id, "status": "skipped"})
                continue

            LOG.info("=== Processing recipe: %s ===", recipe_id)
            recipe_start = time.monotonic()

            # -- Checkpoint dir per recipe --
            local_ckpt_dir = local_checkpoints_root / recipe_id
            local_ckpt_dir.mkdir(parents=True, exist_ok=True)
            ckpt_s3_prefix = f"{ML_CHECKPOINTS_PREFIX}{recipe_id}/"

            # Sync any existing checkpoints from S3 (resume from interruption)
            s3_sync_prefix_down(S3_BUCKET, ckpt_s3_prefix, local_ckpt_dir)

            # -- Run walk --
            walk_result = run_walk(
                recipe_id=recipe_id,
                local_data_dir=local_data_dir,
                local_output_dir=local_output_dir,
                local_checkpoint_dir=local_ckpt_dir,
            )

            # -- Upload checkpoints to S3 immediately after walk (even on failure) --
            if local_ckpt_dir.exists():
                s3_sync_dir_up(local_ckpt_dir, S3_BUCKET, ckpt_s3_prefix)

            cap_results: dict[str, str] = {}
            if walk_result.get("status") == "ok":
                # -- Run 5 capability scripts --
                walk_output_dir = local_output_dir / f"run_{recipe_id}"
                cap_results = run_capability_scripts(
                    recipe_id=recipe_id,
                    walk_output_dir=walk_output_dir,
                    local_data_dir=local_data_dir,
                )

                # -- Upload walk output to S3 (results prefix) --
                if walk_output_dir.exists():
                    s3_sync_dir_up(walk_output_dir, S3_BUCKET, result_key.replace("-result.json", "/"))

            recipe_elapsed = time.monotonic() - recipe_start
            recipe_summary = {
                "recipe_id": recipe_id,
                "status": walk_result.get("status", "unknown"),
                "walk_wall_clock_seconds": walk_result.get("wall_clock_seconds"),
                "capability_results": cap_results,
            }
            job_summary.append(recipe_summary)
            LOG.info("Recipe %s done in %.0f s | status=%s", recipe_id, recipe_elapsed, walk_result.get("status"))

        # ------------------------------------------------------------------
        # Step 3: finalize canary metrics and upload summary.
        # ------------------------------------------------------------------
        fleet_elapsed = time.monotonic() - fleet_start
        cpu_mean = cpu_sampler.stop()

        # Rough cost estimate: c7g.large on-demand is ~$0.0725/hr in eu-central-1
        # Spot is typically ~60-70% off → ~$0.025/hr. Use Spot estimate.
        _SPOT_HOURLY_USD = 0.025
        estimated_cost_usd = (_SPOT_HOURLY_USD * fleet_elapsed) / 3600

        summary = {
            "run_mode": RUN_MODE,
            "recipe_ids": recipe_ids,
            "job_summary": job_summary,
            "fleet_wall_clock_seconds": fleet_elapsed,
            "cpu_utilization_pct_mean_walk": round(cpu_mean, 1),
            "estimated_cost_usd": round(estimated_cost_usd, 4),
        }
        LOG.info("Fleet summary: %s", json.dumps(summary, indent=2))

        # Upload per-run fleet summary
        run_name = os.environ.get("AWS_BATCH_JOB_ID", "local")
        summary_key = f"{ML_RESULTS_PREFIX}fleet-summary-{run_name}.json"
        s3_upload_json(summary, S3_BUCKET, summary_key)

        # In canary mode: also write a canary-specific result for the SFN gate.
        if RUN_MODE == "canary" and recipe_ids:
            canary_recipe = recipe_ids[0]
            canary_result_key = f"{ML_RESULTS_PREFIX}canary-result-{canary_recipe}.json"
            s3_upload_json(
                {
                    "canary_recipe_id": canary_recipe,
                    "status": job_summary[0].get("status") if job_summary else "unknown",
                    "wall_clock_seconds": job_summary[0].get("walk_wall_clock_seconds") if job_summary else None,
                    "cpu_utilization_pct_mean_walk": round(cpu_mean, 1),
                    "estimated_cost_usd": round(estimated_cost_usd, 4),
                    "message": (
                        "Canary complete. Review this file then send-task-success "
                        f"with the token from s3://{S3_BUCKET}/{ML_RESULTS_PREFIX}"
                        f"canary-task-token-{canary_recipe}.txt to approve fan-out."
                    ),
                },
                S3_BUCKET,
                canary_result_key,
            )

    LOG.info("recipe-fleet-entrypoint done | wall_clock=%.0f s | cpu_mean=%.1f%%", fleet_elapsed, cpu_mean)


if __name__ == "__main__":
    main()
