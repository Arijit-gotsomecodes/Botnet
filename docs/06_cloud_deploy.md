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

## 4. Deploy Backend to AWS Elastic Beanstalk

### 4.1 Prerequisites
```bash
pip install awsebcli
eb --version
```

### 4.2 Create the Application
```bash
cd backend

# Initialise EB (select us-east-1, Python 3.11, no CodeCommit)
eb init cloud-soc-backend --region us-east-1 --platform "Python 3.11"
```

### 4.3 Create a Procfile
The EB Python platform needs a `Procfile` to know how to start the server:

```bash
cat > Procfile << 'EOF'
web: uvicorn main:app --host 0.0.0.0 --port 8000
EOF
```

### 4.4 Set Environment Variables on EB
```bash
eb setenv USE_S3=true AWS_REGION=us-east-1
```
> EB instances use IAM roles — no `AWS_ACCESS_KEY_ID` needed if you attach the `AmazonS3ReadOnlyAccess` policy to the EB instance profile.

### 4.5 Create and Deploy the Environment
```bash
eb create cloud-soc-prod --instance-type t3.small --single
```
This will:
- Package the `backend/` directory
- Upload to S3 (EB deployment bucket)
- Launch an EC2 instance
- Install dependencies from `requirements.txt`
- Start uvicorn via the `Procfile`
- On startup, pull model files from S3 automatically

### 4.6 Get the Public URL
```bash
eb status
# Look for: CNAME: cloud-soc-prod.elasticbeanstalk.com
```

Test it:
```bash
curl http://cloud-soc-prod.elasticbeanstalk.com/health
```

### 4.7 Future Deploys (after code changes)
```bash
eb deploy cloud-soc-prod
```

---

## 5. Deploy Frontend to Netlify

```bash
cd frontend
npm run build
# Drag and drop the `dist/` folder to https://app.netlify.com/drop
```

Then update `frontend/src/api.ts` to point to the EB URL:
```typescript
const API_BASE = "http://cloud-soc-prod.elasticbeanstalk.com";
```

---

## 6. Full Architecture (Target State)

```
User Browser
    │
    ▼
Netlify (React SPA)          ← static build from dist/
    │  REST + SSE
    ▼
AWS Elastic Beanstalk         ← FastAPI + uvicorn (t3.small)
    │  boto3 on startup
    ├──▶ S3: cloud-soc-ml-artifacts-*   (models)
    └──▶ S3: cloud-soc-dataset-*        (IoT-23 dev_scale)
```

---

## 7. Service Mapping (Brief Evidence)

| Brief Requirement | How We Cover It |
|---|---|
| Data collected online | IoT-23 from https://www.stratosphereips.org/datasets-iot23 |
| Cloud storage | S3 buckets for dataset + model artifacts |
| Cloud model serving | FastAPI on Elastic Beanstalk loads models from S3 |
| Prototype to end-users | Public Netlify URL → EB backend |
| Latency reporting | `/predict` timer + `/health` S3 sync duration |
| Scalability | EB auto-scaling group; benchmark across dataset sizes |
