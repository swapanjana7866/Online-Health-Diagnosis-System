# Phase 0 Goal: Baseline Setup & Monorepo Architecture

**Phase ID:** `phase-0-setup`  
**Status:** Completed / Active Baseline  
**Prerequisites:** None  

---

## 1. Objective
Establish the foundational multi-service directory structure, environment variable configurations, Git version control hygiene, and base health-check connectivity across the frontend and backend services.

---

## 2. Scope & Deliverables

### In Scope
- Multi-tier folder structure: `backend/`, `frontend/`, `ml-service/`, `Docs/`.
- Repository `.gitignore` preventing `.env`, `node_modules`, `__pycache__`, and build outputs from being tracked.
- Environment variable templates (`.env.example`) with documented variable descriptions.
- Base Express server running with MongoDB connection and health-check endpoint `GET /api/health`.
- Vite + React frontend initialized with base styling and dev server script.

### Out of Scope
- User authentication and database user schemas (deferred to Phase 1).
- Machine learning model training and inference endpoints (deferred to Phase 2).

---

## 3. Technical Specification & Implementation Details

1. **Repository Layout:**
   ```
   health-diagnosis-system/
   ├── backend/         # Node.js/Express API Gateway
   ├── frontend/        # React + Vite Single Page Application
   ├── ml-service/      # Python/FastAPI Machine Learning Microservice
   ├── Docs/            # Specifications, Architecture, Rules, and Phase Goals
   ├── .gitignore
   └── README.md
   ```
2. **Environment Variable Baseline (`backend/.env.example`):**
   ```env
   PORT=5000
   MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/carepath?retryWrites=true&w=majority
   JWT_SECRET=replace_with_a_secure_random_32_character_string
   CLIENT_URL=http://localhost:5173
   ML_SERVICE_URL=http://localhost:8000
   ```
3. **Health Check Endpoint:**
   - URL: `GET /api/health`
   - Response:
     ```json
     {
       "success": true,
       "message": "Health Diagnosis API is running",
       "data": {
         "status": "ok",
         "service": "api-gateway",
         "timestamp": "2026-09-11T11:00:00.000Z"
       },
       "error": null
     }
     ```

---

## 4. Definition of Done (DoD) Checklist
- [x] Workspace structure organized into dedicated service directories.
- [x] Git ignores all sensitive `.env` files, build caches, and node_modules.
- [x] Backend connects to MongoDB and starts on configured `PORT`.
- [x] `GET /api/health` returns HTTP 200 with standardized response envelope.
- [x] Frontend dev server launches cleanly without runtime compiler errors.

---

## 5. Interview / Resume Talking Points
> *"In Phase 0, I established a clean polyglot multi-service architecture from day one. By enforcing clean service boundaries, `.env.example` contracts, and health probes early, the project avoided the configuration debt common in beginner full-stack applications."*
