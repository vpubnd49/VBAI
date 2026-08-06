# VBAI Migration & Deployment Guide

This guide will help you redeploy the VBAI application on a new account (Firebase, Google Cloud, and GitHub).

## 1. Firebase Configuration
You need to create a new Firebase project and update the `firebaseConfig` in `webapp/main.js`.

**Current Configuration:**
```javascript
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "vbai.tracuu.lamdong.vn",
  projectId: "gen-lang-client-0462350485",
  storageBucket: "gen-lang-client-0462350485.firebasestorage.app",
  messagingSenderId: "419728335518",
  appId: "1:419728335518:web:d62ad8064acf7df8fa118f"
};
```

## 2. Google Cloud Platform (GCP)
The application is deployed to **Google Cloud Run**.

- **Project ID:** `gen-lang-client-0462350485`
- **Service Name:** `vbai`
- **Region:** `asia-southeast1`

### Steps for New Account:
1. Create a new GCP project.
2. Enable Cloud Run API, Cloud Build API, and Artifact Registry.
3. Create a Service Account with `Cloud Run Admin` and `Service Account User` roles.
4. Generate a JSON key for this Service Account.

## 3. GitHub Actions
You must set up the following Secret in your new GitHub repository:

- `GCP_SA_KEY`: The content of your new GCP Service Account JSON key.

Update the `env` section in `.github/workflows/deploy.yml` with your new project details:
```yaml
env:
  PROJECT_ID: [YOUR_NEW_PROJECT_ID]
  SERVICE_NAME: vbai-app
  REGION: asia-southeast1
```

## 4. Restoring Agents
All agent logic is backed up in the `backup_agents/` folder.
To restore:
1. Copy the contents of `backup_agents/Skill_...` to their respective directories in the project root.
2. Ensure `node_modules` are installed in the `webapp` folder (`npm install`).

## 6. AI Provider Configuration
The application has been migrated to a **provider-agnostic architecture**. It no longer relies on hardcoded legacy proxies (like 9Router).

To enable AI features:
1. Open the **Chat Assistant** in the web app.
2. Click the **🧩 Configuration (Settings)** icon.
3. Enter your **OpenAI API Key** and **Endpoint** (default: `https://api.openai.com/v1`).
4. Enter your **Google Search API Key** and **CX** to enable real-time legal search.

The configuration will be saved to your local browser storage and synchronized with your Firebase account for persistent access across devices.

## 7. Security Note
A backup of the current `github-sa-key.json` is located in `backup_agents/github-sa-key.json`. **Do not commit this file to public repositories.**
