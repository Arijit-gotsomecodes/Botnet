# 🛡️ Cloud-SOC: IoT Security Operations Dashboard

Welcome to the **Cloud-SOC Dashboard** repository! This project was built for a Cloud Machine Learning course to demonstrate real-time detection of malware in IoT network traffic using Machine Learning deployed on AWS.

![Dashboard Preview](https://img.shields.io/badge/Status-Active-success)
![React](https://img.shields.io/badge/React-18-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-v4-cyan)
![AWS S3](https://img.shields.io/badge/AWS-S3-orange)

## 📚 Team Documentation & Report Guide
If you are a team member looking to understand how this code works or how to write the final IEEE report, **stop reading this README and go to the `docs/` folder:**
1. [Project Overview](docs/01_project_overview.md)
2. [Data Processing & Feature Engineering](docs/02_data_processing.md)
3. [Machine Learning Models (RF, XGBoost, NN)](docs/03_machine_learning_models.md)
4. [System Architecture & Diagrams](docs/04_system_architecture.md)
5. [IEEE Report Writing Guide](docs/05_ieee_report_guide.md)
6. [Cloud Deployment Guide (AWS)](docs/06_cloud_deploy.md)

---

## ☁️ Cloud Infrastructure (AWS)
Models and dataset are stored in AWS S3 and downloaded automatically on server startup.

| Bucket | Contents |
|---|---|
| `cloud-soc-ml-artifacts-269223836366` | Trained model `.joblib` files + metric JSON files |
| `cloud-soc-dataset-269223836366` | IoT-23 `dev_scale` dataset (train/val/test TSVs, ~417 MB) |

---

## 🚀 Quick Start Guide (Local Development)

This project consists of a Python FastAPI backend and a React/Vite frontend. Both need to be running for the dashboard to work.

### 1. Start the Backend API
The backend handles ML inference, data streaming, and real cloud metrics. On first run it will download models from S3 automatically.
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Copy env file (USE_S3=true is the default — uses ~/.aws/credentials)
cp .env.example .env

# Start the server (runs on http://localhost:8000)
python3 -m uvicorn main:app --reload --port 8000
```

### 2. Start the Frontend Dashboard
```bash
cd frontend
npm install

# Start the dev server (runs on http://localhost:5173)
npm run dev
```

Now open your browser to `http://localhost:5173` to view the dashboard!

## 🧠 Model Training
If you need to retrain the machine learning models or regenerate the learning curves:
```bash
cd backend
# Make sure your venv is activated
python train_models.py
# After retraining, push new models to S3:
python upload_to_s3.py
```
This script reads the dataset from `DATA/`, applies **SMOTE** to balance classes to 50/50, trains Random Forest, XGBoost, and Neural Network, and saves models to `models/`.

## 🎯 Attack Simulation
The **Live Threat Monitor** page includes three attack simulation buttons:
- **Port Scan** — Generates horizontal port scan traffic patterns (single attacker, many ports)
- **DDoS** — Generates distributed denial-of-service traffic (many spoofed sources, single target)
- **C&C** — Generates Command & Control beacon traffic (periodic heartbeats to external server)

Each simulation streams 300 synthetic flows (75% attack, 25% benign background) so you can see how the models classify different attack types in real time.

## ☁️ Deployment
*   **Frontend:** Built with `npm run build`, deployed to **Netlify**.
*   **Backend:** Deployed to **AWS Elastic Beanstalk** (Python 3.11). On boot, pulls models from S3 automatically via `USE_S3=true`.
*   See [Cloud Deployment Guide](docs/06_cloud_deploy.md) for full instructions.

## 📊 Dataset Attribution
This project uses the **IoT-23** dataset, a labeled dataset with malicious and benign IoT network traffic created by the Stratosphere Laboratory (A. Guerra-Manzanares, H. Bahsi, S. Nomm). Available at https://www.stratosphereips.org/datasets-iot23
