"""
s3_loader.py — Download ML model artifacts and dataset files from AWS S3.

Two dedicated buckets are used:
    cloud-soc-ml-artifacts-269223836366  — model .joblib and .json files
    cloud-soc-dataset-269223836366       — IoT-23 dev_scale TSV files

Layout in S3:
    s3://cloud-soc-ml-artifacts-269223836366/models/<file>
    s3://cloud-soc-dataset-269223836366/dev_scale/<file>

Set USE_S3=true to enable (all other AWS config via ~/.aws/credentials or env):
    USE_S3=true
    AWS_REGION=us-east-1   (optional, already correct default)

When USE_S3=true the loader will:
  1. Download each missing model/JSON file into backend/models/ (local cache).
  2. Download each missing dataset TSV into DATA/sample_data/dev_scale/.
  3. Skip files that already exist locally — never re-downloads.
"""

import os
import time
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
USE_S3: bool = os.getenv("USE_S3", "false").lower() == "true"
REGION: str = os.getenv("AWS_REGION", "us-east-1")

MODELS_BUCKET = "cloud-soc-ml-artifacts-269223836366"
DATASET_BUCKET = "cloud-soc-dataset-269223836366"

# Paths relative to this file
BACKEND_DIR = Path(__file__).parent
MODELS_DIR = BACKEND_DIR / "models"
DATA_DIR = BACKEND_DIR.parent / "DATA" / "sample_data" / "dev_scale"

# Files in s3://MODELS_BUCKET/models/
MODEL_FILES = [
    "rf_model.joblib",
    "xgb_model.joblib",
    "nn_model.joblib",
    "preprocessor.joblib",
    "final_metrics.json",
    "confusion_matrices.json",
    "roc_data.json",
    "learning_curves.json",
    "label_distribution.json",
]

# Files in s3://DATASET_BUCKET/dev_scale/
DATASET_FILES = ["train.tsv", "val.tsv", "test.tsv", "sampling_manifest.csv", "sampling_report.txt"]

_s3_client = None
_s3_status: dict = {
    "enabled": False,
    "models_bucket": MODELS_BUCKET,
    "dataset_bucket": DATASET_BUCKET,
    "region": REGION,
    "last_sync": None,
    "errors": [],
}


def _get_client():
    global _s3_client
    if _s3_client is None:
        import boto3
        from botocore import UNSIGNED
        from botocore.config import Config
        # Buckets are public — use unsigned requests so no credentials are needed
        _s3_client = boto3.client("s3", region_name=REGION, config=Config(signature_version=UNSIGNED))
    return _s3_client


def _download(bucket: str, s3_key: str, local_path: Path) -> bool:
    """Download a single object from S3. Returns True on success."""
    if local_path.exists():
        return True  # cache hit — skip download
    local_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        size_resp = _get_client().head_object(Bucket=bucket, Key=s3_key)
        size_mb = size_resp["ContentLength"] / 1_048_576
        print(f"[S3] Downloading s3://{bucket}/{s3_key} ({size_mb:.1f} MB) → {local_path.name}")
        _get_client().download_file(bucket, s3_key, str(local_path))
        return True
    except Exception as exc:
        msg = f"[S3] Failed {bucket}/{s3_key}: {exc}"
        print(msg)
        _s3_status["errors"].append(msg)
        return False


def sync_from_s3() -> dict:
    """
    Pull all model artifacts and dataset files from S3 into local directories.
    Returns a status dict included in /health responses.
    """
    # Re-read at call time so dotenv loaded in startup event takes effect
    use_s3 = os.getenv("USE_S3", "false").lower() == "true"
    if not use_s3:
        _s3_status["enabled"] = False
        return _s3_status

    _s3_status["enabled"] = True
    t0 = time.time()

    # -- Model artifacts from MODELS_BUCKET --
    MODELS_DIR.mkdir(exist_ok=True)
    for fname in MODEL_FILES:
        _download(MODELS_BUCKET, f"models/{fname}", MODELS_DIR / fname)

    # -- Dataset TSVs from DATASET_BUCKET --
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for fname in DATASET_FILES:
        _download(DATASET_BUCKET, f"dev_scale/{fname}", DATA_DIR / fname)

    _s3_status["last_sync"] = time.time()
    _s3_status["sync_duration_s"] = round(time.time() - t0, 2)
    return _s3_status


def get_status() -> dict:
    """Return the current S3 sync status (for /health endpoint)."""
    return _s3_status
