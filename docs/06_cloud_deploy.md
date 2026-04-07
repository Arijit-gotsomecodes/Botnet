# ☁️ Cloud Deployment Guide

> **Status:** S3 storage is **live**. Elastic Beanstalk deployment is the next step.

---

## 1. What's Already Done

### S3 Buckets (us-east-1) — Live ✅

| Bucket | Contents |
|---|---|
| `cloud-soc-ml-artifacts-269223836366` | `models/rf_model.joblib`, `xgb_model.joblib`, `nn_model.joblib`, `preprocessor.joblib`, + 5 JSON metric files |
| `cloud-soc-dataset-269223836366` | `dev_scale/train.tsv` (282 MB), `val.tsv` (63 MB), `test.tsv` (72 MB), `sampling_manifest.csv` |
| `cloud-soc-dashboard-269223836366` | Reserved for frontend static build |

### How It Works (S3 Integration)
The backend has a `backend/s3_loader.py` module. On startup, if `USE_S3=true`:
1. Connects to both S3 buckets using `boto3`.
2. Downloads any missing model `.joblib` / `.json` files into `backend/models/` (local cache).
3. Downloads any missing dataset TSVs into `DATA/sample_data/dev_scale/`.
4. Skips files that already exist locally — never re-downloads.
5. Reports sync status on the `/health` endpoint.

### Verify It's Working
```bash
curl http://localhost:8000/health
```
Look for `"s3": {"enabled": true, "errors": [], "sync_duration_s": ...}` in the response.

---

## 2. Run Locally with S3 Enabled

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Enable S3 (AWS credentials come from ~/.aws/credentials automatically)
cp .env.example .env
# .env already has USE_S3=true and AWS_REGION=us-east-1

python3 -m uvicorn main:app --reload --port 8000
```

You will see download logs on the first run:
```
[S3] Downloading s3://cloud-soc-ml-artifacts-269223836366/models/rf_model.joblib (1.7 MB) → rf_model.joblib
[S3] Downloading s3://cloud-soc-ml-artifacts-269223836366/models/xgb_model.joblib (0.2 MB) → xgb_model.joblib
...
```

---

## 3. Re-upload Models to S3 (after retraining)

If you retrain the models with `python train_models.py`, push the new files:

```bash
cd backend
export AWS_S3_BUCKET=cloud-soc-ml-artifacts-269223836366
export AWS_REGION=us-east-1
python upload_to_s3.py
```

---

## 4. Deploy Backend to AWS EC2

### 4.1 Launch an EC2 Instance
1. Launch a `t3.small` instance in `us-east-1` using Amazon Linux 2023 or Ubuntu.
2. Edit the Security Group to allow inbound traffic on port `8000`.

### 4.2 Setup the Environment
SSH into the instance and install dependencies:
```bash
sudo yum update -y
sudo yum install python3 pip git -y
# Clone your repository here
cd Botnet/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4.3 Configure and Start systemd Service
To ensure the backend runs continuously and restarts on boot:
```bash
sudo nano /etc/systemd/system/cloud-soc.service
```
Add the following configuration (adjust paths as needed):
```ini
[Unit]
Description=Cloud-SOC FastAPI Backend

[Service]
User=ec2-user
WorkingDirectory=/home/ec2-user/Botnet/backend
Environment="PATH=/home/ec2-user/Botnet/backend/venv/bin"
Environment="USE_S3=true"
ExecStart=/home/ec2-user/Botnet/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000

[Install]
WantedBy=multi-user.target
```
Start and enable the service:
```bash
sudo systemctl daemon-reload
sudo systemctl start cloud-soc
sudo systemctl enable cloud-soc
```

Test it:
```bash
curl http://<EC2-PUBLIC-IP>:8000/health
```

---

## 5. Deploy Frontend to Amazon S3 and CloudFront

```bash
cd frontend
# Make sure .env.production points to the EC2 IP
# e.g., VITE_API_URL=http://<EC2-PUBLIC-IP>:8000
npm run build
```

Then upload the contents of the `dist/` directory to your S3 bucket (`cloud-soc-dashboard-269223836366`), ensuring static website hosting is enabled. Finally, point an Amazon CloudFront distribution to the S3 bucket for fast global delivery.

---

## 6. Full Architecture (Target State)

```
User Browser
    │
    ▼
Amazon CloudFront
    │  
    ▼
S3: cloud-soc-dashboard-*    (React SPA static build)
    │  REST + SSE
    ▼
AWS EC2 Instance              ← FastAPI + uvicorn (t3.small)
    │  boto3 on startup
    ├──▶ S3: cloud-soc-ml-artifacts-*   (models)
    └──▶ S3: cloud-soc-dataset-*        (IoT-23 dev_scale)
```

---

## 7. Service Mapping (Brief Evidence)

| Brief Requirement | How We Cover It |
|---|---|
| Data collected online | IoT-23 from https://www.stratosphereips.org/datasets-iot23 |
| Cloud storage | S3 buckets for dataset + model artifacts + frontend hosting |
| Cloud model serving | FastAPI on EC2 loads models from S3 |
| Prototype to end-users | Public CloudFront URL → EC2 backend |
| Latency reporting | `/predict` timer + `/health` S3 sync duration |
| Scalability | Stateless EC2 backend allows replication behind a load balancer |
