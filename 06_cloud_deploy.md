# ☁️ Cloud Deployment Guide

> **What this document covers:** How to take what's running on your laptop right now and put it live on AWS. No SageMaker, no overcomplication — just the services we actually need.

---

## 1. The Big Picture

Right now, everything runs locally:

```
Your laptop
├── backend/   → uvicorn on http://localhost:8000
└── frontend/  → Vite dev server on http://localhost:5173
```

In the cloud, it will look like this:

```
AWS
├── Elastic Beanstalk  → runs our FastAPI backend (with the models baked in)
├── Amazon S3          → stores the dev_scale TSV data files
├── S3 + CloudFront    → hosts the React frontend (static files)
└── CloudWatch         → monitoring/logs (comes free with Elastic Beanstalk)
```

**Why Elastic Beanstalk for the backend?**
Our `/stream` endpoint uses Server-Sent Events (SSE) — a long-running connection. Lambda has a 29-second timeout and doesn't support this well. Elastic Beanstalk runs our FastAPI app like a normal server, so SSE works out of the box.

**Why not SageMaker?**
The models are already loaded from `.joblib` files in `backend/models/`. They're small enough to bundle directly with the backend. SageMaker is for teams managing hundreds of models — overkill for us.

---

## 2. Prerequisites

You need:
- An AWS account (free tier works)
- AWS CLI installed and configured
- EB CLI installed
- Node.js + npm (for building the frontend)
- Python 3.11+

```bash
# Install AWS CLI
brew install awscli

# Install EB CLI
pip install awsebcli

# Configure AWS credentials
aws configure
# Enter: Access Key ID, Secret Key, Region (eu-west-1), Output (json)

# Verify it works
aws sts get-caller-identity
```

---

## 3. Step 1 — Upload the Data to S3

The `DATA/sample_data/dev_scale/` folder is not in git (it's too large), but the backend needs it at runtime for the `/stream` endpoint and `/stats`.

### 3.1 Create an S3 bucket

```bash
aws s3 mb s3://cloud-soc-data --region eu-west-1
```

### 3.2 Upload the dev_scale TSV files

```bash
aws s3 sync DATA/sample_data/dev_scale/ s3://cloud-soc-data/dev_scale/
aws s3 cp DATA/sampling_report.txt s3://cloud-soc-data/sampling_report.txt
```

This uploads:
- `train.tsv` — training data (~50K rows after our sampling pipeline)
- `val.tsv` — validation data (~15K rows)
- `test.tsv` — test data (~15K rows, used for the live stream)
- `sampling_report.txt` — audit trail parsed by the Data Pipeline page

### 3.3 Tell the backend where to find the data

In `backend/data_loader.py`, the data path is currently hardcoded to a local `DATA/` folder. We need it to download from S3 when running in the cloud.

Add this near the top of `data_loader.py`:

```python
import os
import boto3
from pathlib import Path

S3_BUCKET = os.environ.get("S3_DATA_BUCKET")  # set this in EB environment
DATA_DIR = Path(__file__).parent.parent / "DATA" / "sample_data" / "dev_scale"

def _ensure_data_local():
    """Download TSV files from S3 if not present locally."""
    if not S3_BUCKET:
        return  # running locally, use local files as normal
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    s3 = boto3.client("s3")
    for filename in ["train.tsv", "val.tsv", "test.tsv"]:
        local_path = DATA_DIR / filename
        if not local_path.exists():
            print(f"Downloading {filename} from S3...")
            s3.download_file(S3_BUCKET, f"dev_scale/{filename}", str(local_path))

_ensure_data_local()  # runs once at import time
```

> **Note:** The trained models in `backend/models/` are already committed to git, so they travel with the code automatically — no need to put them in S3.

---

## 4. Step 2 — Deploy the Backend to Elastic Beanstalk

### 4.1 Add a requirements entry for boto3

```bash
echo "boto3==1.35.0" >> backend/requirements.txt
```

### 4.2 Create a Procfile

Elastic Beanstalk needs to know how to start the app. Create this file at `backend/Procfile`:

```
web: uvicorn main:app --host 0.0.0.0 --port 8000
```

### 4.3 Initialise the EB app

```bash
cd backend
eb init cloud-soc-api --platform python-3.11 --region eu-west-1
# When asked about SSH: yes (useful for debugging)
```

### 4.4 Create the environment and deploy

```bash
eb create cloud-soc-env \
  --instance-type t3.small \
  --envvars S3_DATA_BUCKET=cloud-soc-data
```

This will:
1. Package your `backend/` folder
2. Upload it to AWS
3. Spin up an EC2 instance with Python 3.11
4. Install your `requirements.txt`
5. Start the app via the `Procfile`

It takes about 5 minutes the first time.

### 4.5 Get your backend URL

```bash
eb status
# Look for: CNAME: cloud-soc-env.eba-xxxxxx.eu-west-1.elasticbeanstalk.com
```

Test it:
```bash
curl http://cloud-soc-env.eba-xxxxxx.eu-west-1.elasticbeanstalk.com/health
# Should return: {"status": "ok", "models_ready": true, ...}
```

### 4.6 Future deploys (after code changes)

```bash
cd backend
eb deploy
```

---

## 5. Step 3 — Deploy the Frontend to S3 + CloudFront

The React frontend builds to a folder of static HTML/JS/CSS files. We host those on S3 and put CloudFront in front for HTTPS and fast delivery.

### 5.1 Point the frontend at the real backend

In `frontend/src/api.ts`, update the API base URL:

```typescript
// Change this line:
const API_BASE = '/api';

// To this (replace with your actual EB URL):
const API_BASE = import.meta.env.VITE_API_URL || '/api';
```

Create `frontend/.env.production`:

```
VITE_API_URL=http://cloud-soc-env.eba-xxxxxx.eu-west-1.elasticbeanstalk.com
```

### 5.2 Build the frontend

```bash
cd frontend
npm install
npm run build
# Output goes to frontend/dist/
```

### 5.3 Create an S3 bucket for the frontend

```bash
aws s3 mb s3://cloud-soc-dashboard --region eu-west-1

# Enable static website hosting
aws s3 website s3://cloud-soc-dashboard \
  --index-document index.html \
  --error-document index.html
```

### 5.4 Upload the build

```bash
aws s3 sync frontend/dist/ s3://cloud-soc-dashboard/ --delete
```

### 5.5 Create a CloudFront distribution

```bash
aws cloudfront create-distribution \
  --origin-domain-name cloud-soc-dashboard.s3-website-eu-west-1.amazonaws.com \
  --default-root-object index.html \
  --query 'Distribution.DomainName' \
  --output text
```

This returns a URL like `d1234abcdef.cloudfront.net` — that's your live dashboard.

> **Why CloudFront?** S3 alone serves over HTTP. CloudFront gives you HTTPS, which browsers require for EventSource (SSE). Without it, the Live Threat Monitor won't work.

### 5.6 Fix React Router on CloudFront (SPA routing)

React Router handles navigation client-side, but CloudFront doesn't know that `/models` should serve `index.html`. Fix it:

```bash
# Get your CloudFront distribution ID first
aws cloudfront list-distributions --query 'DistributionList.Items[*].{ID:Id,Domain:DomainName}'

# Create a custom error response
aws cloudfront update-distribution --id YOUR_DIST_ID \
  --default-root-object index.html \
  --if-match $(aws cloudfront get-distribution --id YOUR_DIST_ID --query 'ETag' --output text)
```

Or just do it in the AWS Console: CloudFront → your distribution → Error Pages → Create custom error response:
- HTTP error code: 404
- Response page path: `/index.html`
- HTTP response code: 200

---

## 6. What's Running Where — Final Architecture

```
User's browser
     │
     ▼
CloudFront (HTTPS) ──► S3 bucket
  d1234.cloudfront.net     cloud-soc-dashboard
  (React dashboard)        (static HTML/JS/CSS)
     │
     │ API calls + SSE stream
     ▼
Elastic Beanstalk
  cloud-soc-env.elasticbeanstalk.com
  (FastAPI + ML models)
     │
     │ downloads TSV data on startup
     ▼
S3 bucket
  cloud-soc-data
  (train.tsv, val.tsv, test.tsv)
```

CloudWatch logs are collected automatically from Elastic Beanstalk — no extra setup needed.

---

## 7. Cost Estimate (Monthly)

| Service | What it does | Est. cost |
|---|---|---|
| **Elastic Beanstalk** (t3.small) | Runs the FastAPI backend | ~$15–18 |
| **S3** (data + frontend) | Stores TSV files + static assets | ~$0.10 |
| **CloudFront** | HTTPS frontend delivery | ~$0.50 |
| **CloudWatch** | Logs from EB (free tier) | $0 |
| **Data transfer** | API responses, SSE stream | ~$1–2 |
| **Total** | | **~$17–21/mo** |

> For a course demo you can stop the EB environment between sessions (`eb terminate` or just stop the EC2 instance) to avoid charges when not in use.

---

## 8. Quick Deploy Checklist

First-time setup:
- [ ] `aws configure` — credentials set up
- [ ] `aws s3 mb s3://cloud-soc-data` — data bucket created
- [ ] TSV files uploaded to S3
- [ ] `boto3` added to `requirements.txt`
- [ ] `Procfile` created in `backend/`
- [ ] `data_loader.py` updated to download from S3
- [ ] `eb init` + `eb create` — backend deployed
- [ ] Backend `/health` returns `"models_ready": true`
- [ ] `frontend/.env.production` pointing to EB URL
- [ ] `npm run build` — frontend built
- [ ] Frontend dist uploaded to S3
- [ ] CloudFront distribution created
- [ ] CloudFront 404 → `index.html` error page configured
- [ ] Open CloudFront URL in browser — dashboard loads and stream works

Future updates:
- Backend change → `eb deploy` from `backend/`
- Frontend change → `npm run build` then `aws s3 sync dist/ s3://cloud-soc-dashboard/ --delete`

---

## 9. Teardown (Avoid Charges After the Demo)

```bash
# Stop the backend (biggest cost)
eb terminate cloud-soc-env

# Empty and delete S3 buckets
aws s3 rm s3://cloud-soc-data --recursive
aws s3 rb s3://cloud-soc-data

aws s3 rm s3://cloud-soc-dashboard --recursive
aws s3 rb s3://cloud-soc-dashboard

# Disable and delete CloudFront distribution (do this in the AWS Console —
# you must disable it first, wait ~15 min, then delete)
```
