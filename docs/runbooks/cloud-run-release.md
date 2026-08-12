# Cloud Run Release & Rollback Runbook — VBAI Legal Pro V4

## Overview
Standard operating procedures for staging deployment, canary verification, traffic management, and emergency rollback on Google Cloud Run.

---

## 1. Staging Release Procedure

### Step 1: Pre-Flight Verification
Run all local gate checks prior to triggering release:
```powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File E:\Repos\VBAI-ops\prompt03-test-runner.ps1
```

### Step 2: Trigger GitHub Workflow Deployment
Deploy candidate to Cloud Run with `--no-traffic`:
```bash
gcloud run deploy vbai-proxy \
  --project gen-lang-client-0462350485 \
  --region asia-southeast1 \
  --source ./proxy \
  --no-traffic \
  --tag candidate
```

### Step 3: Canary Verification
Execute automated smoke test against the candidate revision URL (`https://candidate---vbai-proxy-419728335518.asia-southeast1.run.app`):
```bash
curl -f https://candidate---vbai-proxy-419728335518.asia-southeast1.run.app/health
```

---

## 2. Traffic Migration & Release Finalization

Once canary smoke tests pass:
```bash
# Shift 100% traffic to the latest candidate revision
gcloud run services update-traffic vbai-proxy \
  --project gen-lang-client-0462350485 \
  --region asia-southeast1 \
  --to-revisions LATEST=100
```

---

## 3. Emergency Rollback Procedure

If runtime anomalies or errors occur post-release:

### Step 1: Identify Previous Healthy Revision
```bash
gcloud run revisions list \
  --service vbai-proxy \
  --project gen-lang-client-0462350485 \
  --region asia-southeast1
```

### Step 2: Immediate Traffic Rollback
Shift 100% traffic back to the previous healthy revision SHA/name:
```bash
gcloud run services update-traffic vbai-proxy \
  --project gen-lang-client-0462350485 \
  --region asia-southeast1 \
  --to-revisions PREVIOUS_HEALTHY_REVISION=100
```

### Step 3: Verify Rollback Health
```bash
curl -f https://vbai-proxy-419728335518.asia-southeast1.run.app/health
```
