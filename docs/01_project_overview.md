# 🌟 Cloud-SOC Dashboard: Project Overview

> **Note to the team:** Hey guys, I built this dashboard for our Cloud Machine Learning project. I know some of you are new to machine learning and cloud architectures, so I wrote this guide as simply as possible. Think of this as your "cheat sheet" to understand exactly what I built so we can crush the IEEE report together! 🚀

## 1. What is this project?
We built a **Cloud-Based IoT Security Operations Center (Cloud-SOC) Dashboard**. 

![Cloud-SOC Concept](images/01_cloud_soc_concept.png)

Imagine you are a security guard, but instead of monitoring cameras, you are monitoring internet traffic (data packets) coming from smart devices (IoT devices like smart fridges, smart cameras, etc.). Our dashboard uses **Machine Learning** to instantly look at that traffic and say: *"Hey, this looks like normal traffic"* (🟢 **Benign**) or *"Watch out, this is a malware attack!"* (🔴 **Malicious**).

### The "Cloud Machine Learning" Angle
Since this is for our Cloud ML course, we aren't just building a simple app. We built a system designed to simulate **a real-world hybrid cloud environment**. 
- We process huge amounts of data.
- We simulate what happens when traffic spikes (Auto-scaling).
- We show how fast our models react (Latency & Throughput).

## 2. Why did we build this? (The Problem)
IoT devices are notoriously insecure. Hackers often take them over to create "botnets" to launch massive DDoS (Distributed Denial of Service) attacks or scan networks for vulnerabilities. 

**The Challenge:** Human security analysts cannot read millions of internet packets per second. 
**Our Solution:** We trained Machine Learning models to do it for them, in real-time, and we built a beautiful dashboard to visualize it.

## 3. What does the Dashboard actually do?
Our dashboard has 5 main pages, each proving a different concept for our project:

1. **Live Threat Monitor:** Streams real-time network traffic scored by our ML model. Includes three **attack simulation buttons** (Port Scan, DDoS, C&C) that generate realistic synthetic attack traffic so you can see how the models respond to different threat scenarios.
2. **Model Performance:** Proves our Machine Learning actually works. We compare three different "brains" (Algorithms) to see which is smartest.
3. **Cloud Infrastructure:** Shows our real AWS deployment — models served from S3, backend hosted on an EC2 instance, with live latency and throughput metrics.
4. **Explainable AI (XAI):** Machine learning shouldn't be a "black box". This page explains *why* the AI thought something was a hack, showing exactly which data points tipped it off.
5. **Data Pipeline:** Shows the full journey of our data, including a **Class Balancing Strategy** section with before/after SMOTE visualizations proving we handled the dataset's natural class imbalance.

## 4. The Dataset We Used
We used the **IoT-23 dataset**, publicly available online at [stratosphereips.org/datasets-iot23](https://www.stratosphereips.org/datasets-iot23). This dataset was created by real cybersecurity researchers (Stratosphere Laboratory). They literally set up infected IoT devices in a lab, let them attack things, and recorded all the internet traffic.

*   **Total Data:** ~325 million rows across 23 network captures.
*   **What we used:** A scientifically sampled subset of ~2.2 million rows (`dev_scale`) — stored in AWS S3 and downloaded by the backend on startup.

## 5. The Cloud Architecture
Our project uses **real AWS cloud infrastructure**:

| Component | AWS Service |
|---|---|
| ML model files (`.joblib`, `.json`) | `s3://cloud-soc-ml-artifacts-269223836366/models/` |
| IoT-23 `dev_scale` dataset (TSVs) | `s3://cloud-soc-dataset-269223836366/dev_scale/` |
| FastAPI backend | AWS EC2 (systemd service) |
| React frontend | Amazon S3 + CloudFront |

On startup, the backend checks `USE_S3=true` and pulls any missing model/data files from S3 automatically. This is implemented in `backend/s3_loader.py`.

---

**Next up:** Read `02_data_processing.md` to see how we prepared this data!
