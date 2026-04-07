# 📝 IEEE Report Writing Guide

> **Note to the team:** This is your skeleton outline for the final report. Map each section directly from the other `.md` files in this folder.

## Title ideas
*   *Cloud-SOC: A Cloud-Native Dashboard for Real-Time IoT Malware Detection using Ensemble and Deep Learning*
*   *Performance Analysis of ML Models for IoT Intrusion Detection with AWS S3 and EC2 Deployment*

## I. Abstract (100–150 words)
Summarise: IoT botnet problem → IoT-23 dataset → 3 ML models (RF, XGB, NN) → deployed on AWS → real-time dashboard → F1 ~0.977 across all models.

## II. Introduction
*   **Context:** Massive growth of IoT devices and their vulnerability to botnets (DDoS, C&C, port scanning).
*   **Problem:** Manual traffic inspection is impossible at scale — motivate with throughput numbers from `dev_scale` (2.2M flows).
*   **Solution:** Cloud-SOC Dashboard. State research question: *which ML model best balances accuracy, latency, and throughput for real-time IoT intrusion detection in a cloud environment?*
*   **Dataset source:** IoT-23, publicly available at https://www.stratosphereips.org/datasets-iot23
*   **(Use `docs/01_project_overview.md`)**

## III. Related Work (½ page)
Look up 3–4 papers on Google Scholar: *"IoT-23 intrusion detection machine learning"*. For each paper: what did they do, what dataset/model, what did they miss that we address?

## IV. Methodology & Data Processing
*   **Dataset:** IoT-23 — 325M raw rows, 23 captures. We sampled `dev_scale` (~2.2M rows) using a rigorous 10-step reproducible pipeline with 70/15/15 time-based splits and intentional gaps to prevent temporal leakage.
*   **Cloud storage:** Dataset TSVs uploaded to `s3://cloud-soc-dataset-269223836366/dev_scale/`. Backend downloads on startup via `s3_loader.py`.
*   **Preprocessing:** Handle `-` nulls, Label Encode categoricals (`proto`, `conn_state`, `service`), keep 11 behavioral features.
*   **Class imbalance:** SMOTE on training split only (50K → 63,328 rows, perfectly balanced 50/50). Val/Test untouched.
*   **(Use `docs/02_data_processing.md`)**

## V. Machine Learning Models
*   **Random Forest:** 100 trees, max_depth=15, class_weight=balanced.
*   **XGBoost:** 100 estimators, max_depth=8, scale_pos_weight tuned.
*   **Neural Network (MLP):** 3 hidden layers (128→64→32), early stopping.
*   All models stored in `s3://cloud-soc-ml-artifacts-269223836366/models/` and loaded at runtime.
*   Learning curves generated at 10/20/40/60/80/100% of training data.
*   **(Use `docs/03_machine_learning_models.md`)**

## VI. Cloud Architecture
*   **Data collection:** IoT-23 sourced online (stratosphereips.org) → uploaded to S3.
*   **Storage:** Two S3 buckets — one for models, one for dataset.
*   **Serving:** FastAPI on an AWS EC2 instance. On boot, `s3_loader.py` pulls models from S3 (avg. 3.6s cold start).
*   **Frontend:** React SPA hosted on S3 and served through CloudFront, calls EC2 endpoint.
*   Include `/health` JSON screenshot showing `s3.enabled: true`, bucket names, `sync_duration_s`.
*   **(Use `docs/04_system_architecture.md` + `docs/06_cloud_deploy.md`)**

## VII. Evaluation & Results
*   **Metrics:** Accuracy, Precision, Recall, F1-Score, ROC-AUC. Justify F1 over accuracy (class imbalance).
*   **Results table:** RF F1=0.977 | XGB F1=0.977 | NN F1=0.977. Recall=1.000 for all — zero missed attacks.
*   **Latency comparison:** RF vs XGB vs NN inference time (ms) — from `/predict` endpoint timer.
*   **Throughput:** Events/sec from `/stream` SSE endpoint.
*   **Error analysis:** Where do models produce false positives? Analyse confusion matrix — which attack types are misclassified?
*   **Learning curves:** All 3 models converge at ~40% of training data — diminishing returns beyond that.
*   Take screenshots: Model Performance page, Confusion Matrices, ROC curves, SHAP waterfall.

## VIII. Conclusions & Future Work
*   Summarise: all 3 models achieve near-identical F1 (~0.977) and perfect recall on IoT-23.
*   RF/XGB have lower latency than NN → better suited for real-time cloud serving.
*   Cloud deployment on EC2 with a stateless backend allows horizontal scaling; S3 decouples model storage from server lifecycle.
*   Future: real SageMaker endpoint, larger `final_scale` dataset, concept-drift detection.

## IX. Contributions Table
| Team Member | Data Pipeline | ML Training | Backend API | Frontend | Cloud Deploy | Report |
|---|---|---|---|---|---|---|
| Member 1 | | | | | | |
| Member 2 | | | | | | |
| Member 3 | | | | | | |
