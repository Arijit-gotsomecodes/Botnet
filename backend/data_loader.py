"""
data_loader.py — Load and parse IoT-23 TSV data from DATA/sample_data/dev_scale.
"""

import os
import pandas as pd
import numpy as np
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent          # CLOUDMLPROJ/
DATA_DIR = BASE_DIR / "DATA" / "sample_data" / "dev_scale"

FEATURE_COLS_NUMERIC = [
    "duration", "orig_bytes", "resp_bytes",
    "orig_pkts", "resp_pkts",
    "orig_ip_bytes", "resp_ip_bytes",
    "missed_bytes",
]

FEATURE_COLS_CATEGORICAL = ["proto", "conn_state", "service"]

ALL_FEATURE_COLS = FEATURE_COLS_NUMERIC + FEATURE_COLS_CATEGORICAL

LABEL_COL = "label"
DETAILED_LABEL_COL = "detailed-label"

# ── Helpers ──────────────────────────────────────────────────────────────────

def _coerce_numeric(series: pd.Series) -> pd.Series:
    """Convert a column to float, turning '-' and blanks into NaN → 0."""
    return pd.to_numeric(series.replace("-", np.nan), errors="coerce").fillna(0)


def load_tsv(split: str = "test", nrows: int | None = None) -> pd.DataFrame:
    """Load a dev_scale TSV split ('train', 'val', or 'test')."""
    path = DATA_DIR / f"{split}.tsv"
    if not path.exists():
        raise FileNotFoundError(f"TSV not found: {path}")

    df = pd.read_csv(path, sep="\t", nrows=nrows, low_memory=False)

    # Normalise labels
    df[LABEL_COL] = df[LABEL_COL].str.strip().str.capitalize()
    df[LABEL_COL] = df[LABEL_COL].replace({"Benign": "Benign", "Malicious": "Malicious"})

    # Clean detailed-label
    df[DETAILED_LABEL_COL] = df[DETAILED_LABEL_COL].fillna("Unknown").replace("-", "Unknown").replace("(empty)", "Unknown")

    return df


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """
    Build a numeric feature matrix suitable for ML.
    Returns (X_df, feature_names).
    """
    frames = []

    # Numeric features
    for col in FEATURE_COLS_NUMERIC:
        if col in df.columns:
            frames.append(_coerce_numeric(df[col]).rename(col))

    # Categorical → label-encoded integers
    for col in FEATURE_COLS_CATEGORICAL:
        if col in df.columns:
            codes = df[col].astype(str).fillna("unknown")
            codes = codes.astype("category").cat.codes.astype(float)
            frames.append(codes.rename(col))

    X = pd.concat(frames, axis=1)
    return X, list(X.columns)


def prepare_labels(df: pd.DataFrame) -> np.ndarray:
    """Return binary labels: 0=Benign, 1=Malicious."""
    return (df[LABEL_COL] == "Malicious").astype(int).values


# ── Streaming iterator ───────────────────────────────────────────────────────

def stream_test_rows(batch: int = 1):
    """
    Generator that yields dicts from test.tsv one-at-a-time (or in batches).
    Used for SSE streaming endpoint.
    """
    path = DATA_DIR / "test.tsv"
    # Read in chunks to avoid loading 380K rows into memory
    for chunk in pd.read_csv(path, sep="\t", chunksize=batch, low_memory=False):
        chunk[LABEL_COL] = chunk[LABEL_COL].str.strip().str.capitalize()
        chunk[DETAILED_LABEL_COL] = chunk[DETAILED_LABEL_COL].fillna("Unknown").replace("-", "Unknown")
        for _, row in chunk.iterrows():
            yield row.to_dict()


# ── Quick stats ──────────────────────────────────────────────────────────────

def dataset_stats() -> dict:
    """Return high-level stats about the dev_scale dataset."""
    stats = {}
    for split in ("train", "val", "test"):
        path = DATA_DIR / f"{split}.tsv"
        if not path.exists():
            continue
        # Count lines without loading whole file
        with open(path, "r") as f:
            total = sum(1 for _ in f) - 1  # subtract header
        stats[split] = {"total_rows": total}

    # Load a small sample for label distribution
    sample = load_tsv("test", nrows=50_000)
    stats["label_distribution"] = sample[LABEL_COL].value_counts().to_dict()
    stats["detailed_label_distribution"] = (
        sample[DETAILED_LABEL_COL].value_counts().head(10).to_dict()
    )
    stats["columns"] = list(sample.columns)
    stats["num_columns"] = len(sample.columns)
    return stats
