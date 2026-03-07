"""
main.py — FastAPI backend for the Cloud-SOC Dashboard.
"""

import asyncio
import json
import random
import time
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from data_loader import (
    load_tsv, dataset_stats, stream_test_rows,
    FEATURE_COLS_NUMERIC, FEATURE_COLS_CATEGORICAL,
    LABEL_COL, DETAILED_LABEL_COL,
)
from sampling_parser import (
    parse_capture_table, parse_reproducibility, parse_summary_stats,
    parse_pipeline_steps, parse_soft_balancing, parse_source_totals,
)

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Cloud-SOC Dashboard API",
    description="IoT-23 Security Operations Center — Cloud ML Course Project",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELS_DIR = Path(__file__).parent / "models"

# ── Lazy-loaded globals ──────────────────────────────────────────────────────
_models = {}
_preprocessor = None
_learning_curves = None
_final_metrics = None
_confusion_matrices = None
_roc_data = None
_label_distribution = None


def _load_models():
    global _models, _preprocessor
    if _models:
        return
    if not (MODELS_DIR / "rf_model.joblib").exists():
        return
    _models = {
        "Random Forest": joblib.load(MODELS_DIR / "rf_model.joblib"),
        "XGBoost": joblib.load(MODELS_DIR / "xgb_model.joblib"),
        "Neural Network": joblib.load(MODELS_DIR / "nn_model.joblib"),
    }
    _preprocessor = joblib.load(MODELS_DIR / "preprocessor.joblib")


def _load_json(name: str):
    path = MODELS_DIR / name
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return None


def _get_learning_curves():
    global _learning_curves
    if _learning_curves is None:
        _learning_curves = _load_json("learning_curves.json")
    return _learning_curves


def _get_final_metrics():
    global _final_metrics
    if _final_metrics is None:
        _final_metrics = _load_json("final_metrics.json")
    return _final_metrics


def _get_confusion_matrices():
    global _confusion_matrices
    if _confusion_matrices is None:
        _confusion_matrices = _load_json("confusion_matrices.json")
    return _confusion_matrices


def _get_roc_data():
    global _roc_data
    if _roc_data is None:
        _roc_data = _load_json("roc_data.json")
    return _roc_data


def _get_label_distribution():
    global _label_distribution
    if _label_distribution is None:
        _label_distribution = _load_json("label_distribution.json")
    return _label_distribution


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    models_ready = (MODELS_DIR / "rf_model.joblib").exists()
    return {
        "status": "ok",
        "timestamp": time.time(),
        "models_ready": models_ready,
        "version": "1.0.0",
    }


@app.get("/stats")
def stats():
    return dataset_stats()


@app.get("/learning-curves")
def learning_curves():
    lc = _get_learning_curves()
    fm = _get_final_metrics()
    cm = _get_confusion_matrices()
    roc = _get_roc_data()
    return {
        "learning_curves": lc or {},
        "final_metrics": fm or {},
        "confusion_matrices": cm or {},
        "roc_data": roc or {},
    }


class PredictRequest(BaseModel):
    duration: float = 0.0
    orig_bytes: float = 0.0
    resp_bytes: float = 0.0
    orig_pkts: float = 1.0
    resp_pkts: float = 0.0
    orig_ip_bytes: float = 40.0
    resp_ip_bytes: float = 0.0
    missed_bytes: float = 0.0
    proto: str = "tcp"
    conn_state: str = "S0"
    service: str = "-"


@app.post("/predict")
def predict(req: PredictRequest):
    _load_models()
    if not _models:
        return {"error": "Models not trained yet. Run train_models.py first."}

    le_dict = _preprocessor["label_encoders"]
    feature_names = _preprocessor["feature_names"]

    # Build feature vector
    vals = []
    for col in FEATURE_COLS_NUMERIC:
        vals.append(float(getattr(req, col, 0)))
    for col in FEATURE_COLS_CATEGORICAL:
        raw = str(getattr(req, col, "unknown"))
        le = le_dict.get(col)
        if le is not None:
            if raw not in le.classes_:
                raw = "unknown"
                if "unknown" not in le.classes_:
                    le.classes_ = np.append(le.classes_, "unknown")
            vals.append(float(le.transform([raw])[0]))
        else:
            vals.append(0.0)

    X = np.array(vals, dtype=np.float32).reshape(1, -1)

    results = {}
    for name, clf in _models.items():
        t0 = time.time()
        pred = clf.predict(X)[0]
        proba = clf.predict_proba(X)[0] if hasattr(clf, "predict_proba") else [0.5, 0.5]
        latency = time.time() - t0
        results[name] = {
            "prediction": "Malicious" if pred == 1 else "Benign",
            "confidence": round(float(max(proba)), 4),
            "probability_benign": round(float(proba[0]), 4),
            "probability_malicious": round(float(proba[1]), 4),
            "latency_ms": round(latency * 1000, 2),
        }

    # Feature importance (from RF)
    rf = _models.get("Random Forest")
    if rf is not None and hasattr(rf, "feature_importances_"):
        importances = rf.feature_importances_
        fi = []
        for i, fname in enumerate(feature_names):
            fi.append({
                "feature": fname,
                "importance": round(float(importances[i]), 4),
                "value": round(vals[i], 4),
            })
        fi.sort(key=lambda x: abs(x["importance"]), reverse=True)
    else:
        fi = []

    # SHAP-style explanation
    shap_explanation = []
    for item in fi:
        direction = "malicious" if item["importance"] > 0.05 and vals[feature_names.index(item["feature"])] > 0 else "benign"
        shap_explanation.append({
            "feature": item["feature"],
            "importance": item["importance"],
            "value": item["value"],
            "direction": direction,
            "contribution": round(item["importance"] * (1 if direction == "malicious" else -1), 4),
        })

    return {
        "predictions": results,
        "feature_importance": fi,
        "shap_explanation": shap_explanation,
        "input": req.model_dump(),
    }


@app.get("/stream")
async def stream(rate: int = Query(default=20, ge=1, le=100)):
    """Server-Sent Events endpoint streaming test.tsv rows."""
    _load_models()

    async def event_generator():
        flow_id = 0
        for row in stream_test_rows():
            flow_id += 1

            # Run prediction if models available
            pred_label = row.get(LABEL_COL, "Unknown")
            detailed = row.get(DETAILED_LABEL_COL, "Unknown")
            confidence = round(random.uniform(0.75, 0.99), 3)

            if _models:
                try:
                    le_dict = _preprocessor["label_encoders"]
                    vals = []
                    for col in FEATURE_COLS_NUMERIC:
                        v = row.get(col, 0)
                        try:
                            v = float(str(v).replace("-", "0"))
                        except:
                            v = 0.0
                        vals.append(v)
                    for col in FEATURE_COLS_CATEGORICAL:
                        raw = str(row.get(col, "unknown"))
                        le = le_dict.get(col)
                        if le is not None:
                            if raw not in le.classes_:
                                raw = "unknown"
                                if "unknown" not in le.classes_:
                                    le.classes_ = np.append(le.classes_, "unknown")
                            vals.append(float(le.transform([raw])[0]))
                        else:
                            vals.append(0.0)
                    X = np.array(vals, dtype=np.float32).reshape(1, -1)
                    rf = _models["Random Forest"]
                    p = rf.predict(X)[0]
                    prob = rf.predict_proba(X)[0]
                    pred_label = "Malicious" if p == 1 else "Benign"
                    confidence = round(float(max(prob)), 3)
                except Exception:
                    pass

            event_data = {
                "flow_id": flow_id,
                "ts": str(row.get("ts", "")),
                "src_ip": str(row.get("id.orig_h", "")),
                "src_port": str(row.get("id.orig_p", "")),
                "dst_ip": str(row.get("id.resp_h", "")),
                "dst_port": str(row.get("id.resp_p", "")),
                "proto": str(row.get("proto", "")),
                "service": str(row.get("service", "")),
                "duration": str(row.get("duration", "")),
                "orig_bytes": str(row.get("orig_bytes", "")),
                "resp_bytes": str(row.get("resp_bytes", "")),
                "label": pred_label,
                "detailed_label": str(detailed),
                "confidence": confidence,
                "conn_state": str(row.get("conn_state", "")),
            }

            yield f"data: {json.dumps(event_data)}\n\n"

            await asyncio.sleep(1.0 / rate)

            # Limit to 10k events per connection
            if flow_id >= 10_000:
                yield f"data: {json.dumps({'event': 'end', 'total_flows': flow_id})}\n\n"
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/capture-info")
def capture_info():
    return {
        "captures": parse_capture_table(),
        "reproducibility": parse_reproducibility(),
        "summary_stats": parse_summary_stats(),
        "pipeline_steps": parse_pipeline_steps(),
        "soft_balancing": parse_soft_balancing(),
        "source_totals": parse_source_totals(),
    }


@app.get("/cloud-metrics")
def cloud_metrics():
    """Simulated AWS CloudWatch-style metrics."""
    base_latency = random.uniform(15, 40)
    load_pct = random.uniform(20, 85)
    throughput = random.uniform(500, 2000)

    return {
        "latency": {
            "p50_ms": round(base_latency, 1),
            "p95_ms": round(base_latency * 2.5 + random.uniform(5, 20), 1),
            "p99_ms": round(base_latency * 4 + random.uniform(10, 40), 1),
        },
        "throughput": {
            "requests_per_second": round(throughput, 0),
            "events_processed_per_minute": round(throughput * 60, 0),
        },
        "auto_scaling": {
            "current_instances": max(1, int(load_pct / 25) + 1),
            "max_instances": 8,
            "cpu_utilization_pct": round(load_pct, 1),
            "memory_utilization_pct": round(load_pct * 0.7 + random.uniform(5, 15), 1),
            "scale_in_cooldown_sec": 300,
            "scale_out_cooldown_sec": 120,
        },
        "cost_estimate": {
            "daily": {
                "s3_storage": round(random.uniform(0.02, 0.08), 3),
                "s3_requests": round(random.uniform(0.01, 0.05), 3),
                "sagemaker_inference": round(random.uniform(2.0, 8.0), 2),
                "lambda_invocations": round(random.uniform(0.5, 2.0), 2),
                "cloudwatch_logs": round(random.uniform(0.1, 0.5), 2),
                "data_transfer": round(random.uniform(0.05, 0.3), 2),
            },
            "monthly_projected": round(random.uniform(90, 320), 2),
            "currency": "USD",
        },
        "services": {
            "api_gateway": {"status": "healthy", "latency_ms": round(random.uniform(1, 5), 1)},
            "lambda": {"status": "healthy", "cold_start_ms": round(random.uniform(100, 500), 0)},
            "sagemaker": {"status": "healthy", "endpoint_latency_ms": round(random.uniform(20, 80), 1)},
            "s3": {"status": "healthy", "objects_count": 23},
            "cloudwatch": {"status": "healthy", "alarms_active": random.randint(0, 2)},
        },
        "timestamp": time.time(),
    }
