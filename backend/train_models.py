"""
train_models.py — Train RF, XGBoost, and Neural Net on IoT-23 dev_scale data.
Produces:
  models/rf_model.joblib
  models/xgb_model.joblib
  models/nn_model.joblib
  models/preprocessor.joblib   (feature names + label encoders)
  models/learning_curves.json  (metrics at 10-100% data)
  models/confusion_matrices.json
"""

import json
import time
import warnings
import os
import sys

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import (
    f1_score, precision_score, recall_score, accuracy_score,
    confusion_matrix, roc_curve, auc,
)
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier

from data_loader import (
    load_tsv, FEATURE_COLS_NUMERIC, FEATURE_COLS_CATEGORICAL,
    LABEL_COL, DETAILED_LABEL_COL,
)

warnings.filterwarnings("ignore")

MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

SUBSAMPLE = 50_000          # rows for training subsample
FRACTIONS = [0.10, 0.20, 0.40, 0.60, 0.80, 1.00]
SEED = 42


def _coerce_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series.replace("-", np.nan), errors="coerce").fillna(0)


def prepare(df: pd.DataFrame, label_encoders: dict | None = None):
    """Return X (np.ndarray), y (np.ndarray), and fitted label_encoders."""
    fit = label_encoders is None
    if fit:
        label_encoders = {}

    frames = []
    for col in FEATURE_COLS_NUMERIC:
        if col in df.columns:
            frames.append(_coerce_numeric(df[col]).values.reshape(-1, 1))

    for col in FEATURE_COLS_CATEGORICAL:
        if col in df.columns:
            vals = df[col].astype(str).fillna("unknown")
            if fit:
                le = LabelEncoder()
                le.fit(vals)
                label_encoders[col] = le
            else:
                le = label_encoders[col]
                # handle unseen categories
                vals = vals.map(lambda x: x if x in le.classes_ else "unknown")
                if "unknown" not in le.classes_:
                    le.classes_ = np.append(le.classes_, "unknown")
            frames.append(le.transform(vals).reshape(-1, 1))

    X = np.hstack(frames).astype(np.float32)
    y = (df[LABEL_COL] == "Malicious").astype(int).values
    feature_names = FEATURE_COLS_NUMERIC + FEATURE_COLS_CATEGORICAL
    return X, y, label_encoders, feature_names


def main():
    print("=" * 60)
    print("IoT-23 Cloud-SOC — Model Training Pipeline")
    print("=" * 60)

    # ── Load data ────────────────────────────────────────────────
    print("\n[1/5] Loading train + val splits …")
    t0 = time.time()
    train_df = load_tsv("train", nrows=SUBSAMPLE)
    val_df   = load_tsv("val",   nrows=15_000)
    test_df  = load_tsv("test",  nrows=15_000)
    print(f"      Loaded {len(train_df)} train, {len(val_df)} val, {len(test_df)} test  ({time.time()-t0:.1f}s)")

    # ── Prepare features ─────────────────────────────────────────
    print("[2/5] Preparing features …")
    X_train, y_train, label_encoders, feature_names = prepare(train_df)
    X_val,   y_val, _, _   = prepare(val_df,  label_encoders)
    X_test,  y_test, _, _  = prepare(test_df, label_encoders)

    # Save preprocessor
    joblib.dump({
        "label_encoders": label_encoders,
        "feature_names": feature_names,
    }, MODELS_DIR / "preprocessor.joblib")

    # ── Define models ─────────────────────────────────────────────
    models = {
        "Random Forest": RandomForestClassifier(
            n_estimators=100, max_depth=15, n_jobs=-1, random_state=SEED,
            class_weight="balanced",
        ),
        "XGBoost": XGBClassifier(
            n_estimators=100, max_depth=8, learning_rate=0.1,
            eval_metric="logloss", random_state=SEED,
            scale_pos_weight=(y_train == 0).sum() / max((y_train == 1).sum(), 1),
            verbosity=0,
        ),
        "Neural Network": MLPClassifier(
            hidden_layer_sizes=(128, 64, 32), max_iter=50,
            early_stopping=True, validation_fraction=0.1,
            random_state=SEED, verbose=False,
        ),
    }
    model_keys = {"Random Forest": "rf", "XGBoost": "xgb", "Neural Network": "nn"}

    # ── Learning curves ──────────────────────────────────────────
    print("[3/5] Training learning curves …")
    learning_curves = {name: {"fractions": [], "train_f1": [], "val_f1": []}
                       for name in models}

    for frac in FRACTIONS:
        n = int(len(X_train) * frac)
        X_sub, y_sub = X_train[:n], y_train[:n]
        print(f"      Fraction {frac:.0%} → {n} rows")

        for name, clf in models.items():
            import copy
            model_copy = copy.deepcopy(clf)
            model_copy.fit(X_sub, y_sub)

            train_pred = model_copy.predict(X_sub)
            val_pred   = model_copy.predict(X_val)

            learning_curves[name]["fractions"].append(frac)
            learning_curves[name]["train_f1"].append(
                round(f1_score(y_sub, train_pred, zero_division=0), 4)
            )
            learning_curves[name]["val_f1"].append(
                round(f1_score(y_val, val_pred, zero_division=0), 4)
            )

    # ── Final training (100%) ────────────────────────────────────
    print("[4/5] Training final models on full subsample …")
    final_metrics = {}
    confusion_matrices = {}
    roc_data = {}

    for name, clf in models.items():
        print(f"      Training {name} …")
        t1 = time.time()
        clf.fit(X_train, y_train)
        train_time = time.time() - t1

        # Save model
        key = model_keys[name]
        joblib.dump(clf, MODELS_DIR / f"{key}_model.joblib")

        # Evaluate on test set
        t2 = time.time()
        test_pred  = clf.predict(X_test)
        test_proba = clf.predict_proba(X_test)[:, 1] if hasattr(clf, "predict_proba") else None
        inference_time = time.time() - t2

        f1  = f1_score(y_test, test_pred, zero_division=0)
        pre = precision_score(y_test, test_pred, zero_division=0)
        rec = recall_score(y_test, test_pred, zero_division=0)
        acc = accuracy_score(y_test, test_pred)
        cm  = confusion_matrix(y_test, test_pred).tolist()

        final_metrics[name] = {
            "f1": round(f1, 4),
            "precision": round(pre, 4),
            "recall": round(rec, 4),
            "accuracy": round(acc, 4),
            "train_time_sec": round(train_time, 2),
            "inference_time_sec": round(inference_time, 4),
            "test_samples": len(y_test),
        }
        confusion_matrices[name] = cm

        # ROC
        if test_proba is not None:
            fpr, tpr, _ = roc_curve(y_test, test_proba)
            roc_auc = auc(fpr, tpr)
            # Downsample ROC for JSON
            indices = np.linspace(0, len(fpr) - 1, min(200, len(fpr)), dtype=int)
            roc_data[name] = {
                "fpr": [round(float(fpr[i]), 4) for i in indices],
                "tpr": [round(float(tpr[i]), 4) for i in indices],
                "auc": round(float(roc_auc), 4),
            }

        print(f"        F1={f1:.4f}  Precision={pre:.4f}  Recall={rec:.4f}  Acc={acc:.4f}")

    # ── Save outputs ─────────────────────────────────────────────
    print("[5/5] Saving outputs …")
    with open(MODELS_DIR / "learning_curves.json", "w") as f:
        json.dump(learning_curves, f, indent=2)

    with open(MODELS_DIR / "final_metrics.json", "w") as f:
        json.dump(final_metrics, f, indent=2)

    with open(MODELS_DIR / "confusion_matrices.json", "w") as f:
        json.dump(confusion_matrices, f, indent=2)

    with open(MODELS_DIR / "roc_data.json", "w") as f:
        json.dump(roc_data, f, indent=2)

    # Save detailed label distribution for the dashboard
    all_detailed = load_tsv("test", nrows=50_000)[DETAILED_LABEL_COL].value_counts().to_dict()
    with open(MODELS_DIR / "label_distribution.json", "w") as f:
        json.dump(all_detailed, f, indent=2)

    print("\n✅  All models trained and saved to backend/models/")
    print("   Files:")
    for p in sorted(MODELS_DIR.iterdir()):
        print(f"     {p.name}  ({p.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
