#!/usr/bin/env python3
"""
upload_to_s3.py — One-shot script to push all model artifacts and dataset
files to the configured S3 bucket.

Usage:
    export AWS_S3_BUCKET=cloud-soc-ml-artifacts
    export AWS_REGION=eu-west-1           # or your region
    # AWS credentials via env vars, ~/.aws/credentials, or IAM role
    python upload_to_s3.py

What gets uploaded:
    backend/models/*.joblib          → s3://<bucket>/models/
    backend/models/*.json            → s3://<bucket>/models/
    DATA/sample_data/dev_scale/*.tsv → s3://<bucket>/data/dev_scale/
    DATA/sample_data/dev_scale/*.csv → s3://<bucket>/data/dev_scale/
"""

import os
import sys
from pathlib import Path

# ── Resolve paths ────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent          # backend/
REPO_ROOT  = SCRIPT_DIR.parent             # project root
MODELS_DIR = SCRIPT_DIR / "models"
DATA_DIR   = REPO_ROOT / "DATA" / "sample_data"

BUCKET = os.getenv("AWS_S3_BUCKET", "")
REGION = os.getenv("AWS_REGION", "us-east-1")

if not BUCKET:
    print("ERROR: Set the AWS_S3_BUCKET environment variable before running.")
    sys.exit(1)

# Force USE_S3=true so s3_loader._get_client() works
os.environ["USE_S3"] = "true"
os.environ["AWS_S3_BUCKET"] = BUCKET
os.environ["AWS_REGION"] = REGION

from s3_loader import upload_file  # noqa: E402

# ── Files to upload ──────────────────────────────────────────────────────────
uploads: list[tuple[Path, str]] = []

# Model artifacts
for f in MODELS_DIR.iterdir():
    if f.suffix in {".joblib", ".json"} and f.is_file():
        uploads.append((f, f"models/{f.name}"))

# Dataset (dev_scale only — final_scale is very large, add manually if needed)
dev_scale = DATA_DIR / "dev_scale"
if dev_scale.exists():
    for f in dev_scale.iterdir():
        if f.suffix in {".tsv", ".csv"} and f.is_file():
            uploads.append((f, f"data/dev_scale/{f.name}"))
else:
    print(f"WARNING: {dev_scale} not found — skipping dataset upload.")

# ── Upload ───────────────────────────────────────────────────────────────────
print(f"\nUploading {len(uploads)} files to s3://{BUCKET}/\n")
ok = err = 0
for local_path, s3_key in uploads:
    if upload_file(local_path, s3_key):
        ok += 1
    else:
        err += 1

print(f"\n✅  {ok} uploaded   ❌  {err} failed")
if err:
    sys.exit(1)
