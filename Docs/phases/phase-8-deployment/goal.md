# Phase 8 Goal: Production Cloud Deployment & Live Verification

**Phase ID:** `phase-8-deployment`  
**Status:** Ready to Start  
**Prerequisites:** Phase 4 (Frontend), Phase 5 (Security), Phase 7 (Docs)  

---

## 1. Objective
Deploy all components of the polyglot architecture to production cloud infrastructure (Vercel, Render, and MongoDB Atlas) with HTTPS encryption, zero secret exposure, production environment variables, and verify live end-to-end workflows.

---

## 2. Scope & Deliverables

### In Scope
- **Database Deployment (MongoDB Atlas):**
  - Production cluster with automated backups and network IP access whitelisting.
  - Dedicated production database user with least-privilege credentials.
- **Backend API Gateway Deployment (Render):**
  - Web Service connected to GitHub repository branch `main`.
  - Node.js runtime with `npm start` command (`node server.js`).
  - Production environment variables: `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `ML_SERVICE_URL`.
- **Python ML Inference Microservice Deployment (Render):**
  - Separate Python Web Service running `uvicorn app:app --host 0.0.0.0 --port $PORT`.
  - Internal communication link connecting the API Gateway to this service.
- **Frontend Single Page Application Deployment (Vercel):**
  - React + Vite production build configured with single-page application rewrites (`vercel.json`).
  - Build command: `npm run build`, Output directory: `dist`.
  - Production environment variable: `VITE_API_URL=https://carepath-api.onrender.com`.
- **Live Smoke Testing & Verification:**
  - Complete user registration, login, symptom check-in, and history review on public HTTPS URLs.
  - Verify that no development secrets or `.env` files are exposed in bundle source maps.

### Out of Scope
- Multi-region Kubernetes cluster deployment (unnecessary cost/overhead for portfolio scale).

---

## 3. Production Deployment Architecture Matrix

| Component | Cloud Platform | Build Command | Start Command | Env Vars Required |
|---|---|---|---|---|
| **Frontend** | Vercel | `npm run build` | Static CDN Hosting | `VITE_API_URL` |
| **Node API Gateway** | Render | `npm install` | `node server.js` | `PORT`, `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `ML_SERVICE_URL` |
| **Python ML Service** | Render | `pip install -r requirements.txt` | `uvicorn app:app --host 0.0.0.0 --port $PORT` | `PORT` |
| **Database** | MongoDB Atlas | Managed Cluster | Managed Replica Set | Admin Credentials |

---

## 4. Definition of Done (DoD) Checklist
- [ ] All three services successfully deployed and reachable over public HTTPS.
- [ ] Frontend can communicate with the backend without CORS rejections.
- [ ] Backend communicates with Python ML microservice over internal or HTTPS URL.
- [ ] Live user can register, log in, submit symptoms, and view history seamlessly.
- [ ] Zero unhandled errors in Render service logs or browser developer console.
- [ ] Live demo link and deployment badges added to `README.md`.

---

## 5. Interview / Resume Talking Points
> *"In Phase 8, I transitioned the system from local development to a live, multi-service production topology. Rather than hosting a simple monolithic frontend, I coordinated a cloud architecture spanning a Vercel CDN frontend, a Render Node.js API Gateway, a separate Render Python ML microservice, and a MongoDB Atlas cloud cluster. This allowed me to debug real-world cloud deployment challenges like CORS origins, cold-start latency, and TLS environment variable propagation."*
