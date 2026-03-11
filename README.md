# 🛡️ Cloud-SOC: IoT Security Operations Dashboard

Welcome to the **Cloud-SOC Dashboard** repository! This project was built for a Cloud Machine Learning course to demonstrate the real-time detection of malware in IoT network traffic using Machine Learning and a simulated hybrid-cloud architecture.

![Dashboard Preview](https://img.shields.io/badge/Status-Active-success)
![React](https://img.shields.io/badge/React-18-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-v4-cyan)

## 📚 Team Documentation & Report Guide
If you are a team member looking to understand how this code works or how to write the final IEEE report, **stop reading this README and go to the `docs/` folder:**
1. [Project Overview](docs/01_project_overview.md)
2. [Data Processing & Feature Engineering](docs/02_data_processing.md)
3. [Machine Learning Models (RF, XGBoost, NN)](docs/03_machine_learning_models.md)
4. [System Architecture & Diagrams](docs/04_system_architecture.md)
5. [IEEE Report Writing Guide](docs/05_ieee_report_guide.md)
6. [Cloud Deployment Guide (AWS)](docs/06_cloud_deploy.md)

---

## 🚀 Quick Start Guide (Local Development)

This project consists of a Python FastAPI backend and a React/Vite frontend. Both need to be running for the dashboard to work.

### 1. Start the Backend API
The backend handles ML inference, data streaming, and simulated cloud metrics.
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start the server (runs on http://localhost:8000)
python3 -m uvicorn main:app --reload --port 8000
```

### 2. Start the Frontend Dashboard
The frontend is the visual dashboard.
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
```
This script will read the dataset from `DATA/`, apply **SMOTE** (Synthetic Minority Over-sampling) to balance the training classes to a 50/50 split, train Random Forest, XGBoost, and a Neural Network, and save the resulting models to the `models/` directory.

## 🎯 Attack Simulation
The **Live Threat Monitor** page includes three attack simulation buttons:
- **Port Scan** — Generates horizontal port scan traffic patterns (single attacker, many ports)
- **DDoS** — Generates distributed denial-of-service traffic (many spoofed sources, single target)
- **C&C** — Generates Command & Control beacon traffic (periodic heartbeats to external server)

Each simulation streams 300 synthetic flows (75% attack, 25% benign background) so you can see how the models classify different attack types in real time.

## ☁️ Deployment Architecture
*   **Frontend:** The React SPA is designed to be built (`npm run build`) and deployed to a static host like **Netlify** or Vercel. Redirects are already configured in `public/_redirects`.
*   **Backend:** The FastAPI server is designed to be dockerized and deployed to **AWS EC2**, AWS AppRunner, or a similar cloud provider.

## 📊 Dataset Attribution
This project uses the **IoT-23** dataset, a labeled dataset with malicious and benign IoT network traffic created by the Stratosphere Laboratory (A. Guerra-Manzanares, H. Bahsi, S. Nomm).
