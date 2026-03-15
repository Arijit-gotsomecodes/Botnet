# 🏗️ System Architecture

> **Note to the team:** This explains how the actual "app" works. The backend API serving the frontend. You can literally copy-paste these mermaid diagrams into an IEEE paper visualization tool or take screenshots of them.

Our Cloud-SOC Dashboard uses a decoupled **Client-Server Architecture**.

## 1. High-Level Concept Diagram
This shows the general flow between the Client, the Server, and the Machine Learning engine.

![High Level System Architecture](images/04_architecture_high_level.png)

## 2. Low-Level Component Architecture
This shows exactly how the processes, ports, classes, and filesystem interact with each other in the application.

![Low Level Component Architecture](images/05_architecture_low_level.png)

## 2. The Backend (FastAPI / Python)
*Located in `backend/` directory.*

We built our backend using **FastAPI** because it is incredibly fast (built on ASGI) and perfect for Machine Learning applications, which naturally sit in Python environments (Scikit-learn, XGBoost).

**Cloud startup sequence (`backend/s3_loader.py`):**
On startup, if `USE_S3=true`, the backend connects to AWS S3 and downloads any missing model/data files before serving any requests. This means the server can run with **zero pre-bundled files** — everything is pulled from S3.

**Core Endpoints:**
*   `GET /health`: Returns server status, `models_ready` flag, `dataset_source` URL, and full S3 sync status (bucket names, last sync time, sync duration, errors).
*   `GET /learning-curves`: Returns JSON of F1 scores at 6 training-size fractions per model.
*   `POST /predict`: Receives a JSON network flow, preprocesses it, runs inference on all 3 models, and returns predictions with per-model latency measurements.
*   `GET /stream`: Uses **Server-Sent Events (SSE)** to continuously push real scored network flows from the test dataset to the frontend — live traffic simulation.
*   `GET /stream/simulate`: Accepts `mode=portscan|ddos|cnc` and streams 300 synthetic attack flows for demonstration.
*   `GET /cloud-metrics`: Returns latency, throughput, CPU, memory, and S3 cost metrics for the Cloud Infrastructure page.

## 3. The Frontend (React + TypeScript + Tailwind v4)
*Located in `frontend/` directory.*

We built a modern, dark-themed dashboard using **React 18** and **Vite**.

*   **TypeScript:** Prevents bugs by strictly typing what data looks like.
*   **Tailwind CSS v4:** Utility-first CSS for the dark cyber-security theme.
*   **Plotly.js:** Complex scientific charts — Learning Curves, ROC, Confusion Matrices, SHAP waterfall.

## 4. Real Cloud Infrastructure (AWS)

| AWS Service | Role |
|---|---|
| **S3** `cloud-soc-ml-artifacts-269223836366` | Stores 4 trained model `.joblib` files + 5 metric JSON files |
| **S3** `cloud-soc-dataset-269223836366` | Stores the 417 MB IoT-23 `dev_scale` dataset (train/val/test TSVs) |
| **Elastic Beanstalk** | Hosts the FastAPI backend with managed auto-scaling |
| **Netlify** | Hosts the React frontend (static build) |

## 5. Latency, Throughput, and Scalability Paradigms
As required by the course brief, our architecture demonstrates:
1.  **Throughput:** The `/stream` SSE endpoint pushes scored network flows continuously — measurable as events/second.
2.  **Latency Tracking:** The `/predict` endpoint uses `time.perf_counter()` to measure per-model inference time (typically single-digit milliseconds). `/health` records S3 sync duration.
3.  **Scalability:** Elastic Beanstalk provides real auto-scaling. We benchmark inference latency across dataset sizes to produce scaling curves for the report.
