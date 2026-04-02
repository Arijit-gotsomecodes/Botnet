#!/bin/bash
set -ex

# ── Install Python 3.11 and build tools ──
dnf install -y python3.11 python3.11-pip python3.11-devel gcc gcc-c++ tar gzip

# ── Download backend code from S3 (public bucket, no creds needed) ──
mkdir -p /opt/cloud-soc/backend
aws s3 cp s3://cloud-soc-ml-artifacts-269223836366/deploy/backend.tar.gz /tmp/backend.tar.gz --no-sign-request --region us-east-1
tar -xzf /tmp/backend.tar.gz -C /opt/cloud-soc/backend/

# ── Install Python dependencies ──
cd /opt/cloud-soc/backend
python3.11 -m pip install -r requirements.txt

# ── Create .env ──
cat > /opt/cloud-soc/backend/.env << 'ENVEOF'
USE_S3=true
AWS_REGION=us-east-1
ENVEOF

# ── Set ownership ──
chown -R ec2-user:ec2-user /opt/cloud-soc

# ── Create systemd service (auto-starts on every boot) ──
cat > /etc/systemd/system/cloud-soc.service << 'SVCEOF'
[Unit]
Description=Cloud SOC FastAPI Backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/cloud-soc/backend
ExecStart=/usr/bin/python3.11 -m uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
Environment=USE_S3=true
Environment=AWS_REGION=us-east-1

[Install]
WantedBy=multi-user.target
SVCEOF

# ── Enable and start ──
systemctl daemon-reload
systemctl enable cloud-soc.service
systemctl start cloud-soc.service
