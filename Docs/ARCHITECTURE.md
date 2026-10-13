# Carepath / MedInsight — System Architecture

**Document Version:** 1.0  
**Status:** Approved Architecture Baseline  
**Project:** Online Health Diagnosis System  

---

## 1. Executive Architecture Overview

MedInsight is engineered as a **polyglot microservices system** featuring a 3-tier architecture with an asynchronous/internal ML inference microservice. It is designed to demonstrate production-grade full-stack patterns, robust API design, state-of-the-art security hygiene, and resilient machine learning integration.

### High-Level Topology Diagram

```mermaid
flowchart TD
    subgraph ClientLayer["Frontend Layer (Vercel)"]
        SPA["React + Vite Single Page App"]
        AuthContext["Auth Context (JWT + User State)"]
        AxiosClient["Axios HTTP Client (Interceptors)"]
        SPA --> AuthContext
        SPA --> AxiosClient
    end

    subgraph GatewayLayer["API Gateway Layer (Node/Express - Render)"]
        ExpressApp["Express API Server"]
        SecurityMW["Security Middleware (Helmet, CORS, Rate-Limiter)"]
        AuthMW["JWT Auth Middleware"]
        ValidatorMW["Input Sanitization & Validator"]
        Router["Express Routers (/auth, /users, /diagnosis, /symptoms)"]
        Controllers["Controllers & Business Logic"]
        MLBridge["ML Service Bridge (HTTP Client + Timeout Fallback)"]

        ExpressApp --> SecurityMW --> ValidatorMW --> Router
        Router --> AuthMW --> Controllers
        Controllers --> MLBridge
    end

    subgraph DataLayer["Database Layer (MongoDB Atlas)"]
        Mongo["MongoDB Atlas Replica Set"]
        UsersCol[("Users Collection")]
        DiagCol[("Diagnoses Collection")]
        Mongo --- UsersCol
        Mongo --- DiagCol
    end

    subgraph MLLayer["ML Inference Layer (Python/FastAPI - Render)"]
        FastAPIApp["FastAPI Inference Server"]
        PydanticValidator["Pydantic Payload Validation"]
        VectorEncoder["Multi-Hot Symptom Vectorizer"]
        MLModel["Scikit-Learn Classification Model (model.pkl)"]
        ConfidenceScorer["Top-3 Softmax / predict_proba() Scorer"]

        FastAPIApp --> PydanticValidator --> VectorEncoder --> MLModel --> ConfidenceScorer
    end

    %% Network Connections
    AxiosClient -- "HTTPS / JSON (JWT in Authorization header)" --> ExpressApp
    Controllers -- "Mongoose ODM (BSON over TLS)" --> Mongo
    MLBridge -- "Internal HTTP POST /predict (Timeout = 3000ms)" --> FastAPIApp
```

---

## 2. Architectural Decisions & Rationales (ADRs)

### ADR-01: Polyglot Microservices Pattern (Node.js API Gateway + Python ML Service)
- **Decision:** Separate the primary web API (Node.js/Express) from the Machine Learning inference engine (Python/FastAPI).
- **Rationale:**
  1. *Ecosystem Optimization:* Python is the industry standard for ML training, feature processing, and scikit-learn models. Node.js is optimal for concurrent I/O, JWT handling, and REST routing.
  2. *Gateway Security:* The frontend never accesses the Python ML service directly. The Node.js API acts as an authenticating gateway, preventing public access to unauthenticated ML endpoints.
  3. *Independent Scaling:* If inference traffic increases, the ML service can be scaled independently on Render without affecting auth or history retrieval.

### ADR-02: Stateless JWT Authentication with Client-Side Context
- **Decision:** Use JSON Web Tokens (JWT) signed with HS256 and stored client-side in memory/local storage with Axios interceptors.
- **Rationale:**
  1. Stateless verification eliminates session state lookup on MongoDB for every incoming request.
  2. Protected routes on Express (`/api/diagnosis/*`, `/api/users/*`) verify signatures in memory (`jwt.verify`).

### ADR-03: Multi-Hot Vector Encoding with Graceful Missing Feature Handling
- **Decision:** Symptoms are represented as binary flags (`[0, 1, 0, ...]`) mapped to a fixed dictionary of ~130 symptom features derived from public Kaggle medical datasets.
- **Rationale:**
  1. Avoids fragile and inaccurate NLP free-text parsing in the MVP.
  2. Guarantees deterministic input vectors for the Random Forest classifier.
  3. The FastAPI service strips unseen symptoms and safely fills zeroes for unselected symptoms.

### ADR-04: Graceful Degradation & Circuit-Breaker Fallback
- **Decision:** The Node API Gateway implements a 3-second timeout on the internal ML call.
- **Rationale:** If the ML service is cold-starting or temporarily unavailable, the API does **not** crash or return a 500. Instead, it returns a supportive heuristic fallback with severity-based self-care advice and prompts the user to consult a healthcare provider.

### ADR-05: Symptom-Grounded Prediction Engine with Gemini Candidate Explanations (amended)
- **Decision:** The predicted condition for the disease-prediction flow (`POST /api/diagnoses/predict` and chatbot triage inference) is always grounded by the **Python ML microservice** (ADR-01, validated `SymptomDiseaseClassifier`) or — when it is unreachable — the local heuristic overlap engine (ADR-04). Google Gemini (official `@google/genai` SDK, default model `gemini-3.6-flash`) is used **only to explain the engine's candidate conditions** (supporting/missing symptoms, self-care steps, red-flag warning signs); Gemini never chooses the diagnosis and never supplies a confidence value. `PREDICTION_PROVIDER=ml` disables external Gemini calls in favour of local rule-based explanations. Unrecognized or insufficient input returns a clarification response (HTTP 400 / limited assessment) instead of a condition.
- **Rationale (amended after accuracy review):**
  1. *Reproducibility:* LLM free-generation returned fluent but arbitrary conditions for unrelated or misspelled input, and the heuristic fallback previously returned a fixed default trio — both broke symptom-grounded prediction.
  2. *Honest confidence:* Only the validated classifier reports a probability (held-out n=960: top-1 99.69%, top-3 100%, ECE 0.003; see `ml-service/model/evaluate.py`); heuristic/rule results are labelled as preliminary assessments, never probabilities.
  3. *Best-in-class explanations:* Gemini still produces rich, context-aware candidate explanations, self-care steps, and red-flag warning signs — as explanation, not diagnosis.
  2. *Resilience preserved:* Every Gemini failure mode (missing `GEMINI_API_KEY`, timeout, rate limit, invalid response, provider outage) is mapped to a safe error code and degrades to the ML microservice and then the local heuristic engine — never a 500 crash.
  3. *Privacy by design:* Only symptom names, duration, and self-reported discomfort level are sent to Gemini. No names, demographics, notes, or diagnosis history leave the gateway. The API key is server-side only and never shipped to the frontend.
  4. *Honest outputs:* Gemini output is constrained by a structured-output schema and re-validated server-side (strings capped, enums allow-listed, confidence clamped to an estimated 10–95 range and never presented as a confirmed diagnosis). No consensus/"dual AI" metrics are invented when no second model comparison exists.

---

## 3. Detailed Component Breakdown

### 3.1 Frontend Architecture (`frontend/`)
- **Framework:** React 18+ bundled with Vite.
- **Styling:** Tailwind CSS / Modern CSS design tokens (responsive, high contrast, mobile-friendly).
- **State Management:**
  - `AuthContext`: Centralized authentication store holding current user token, user profile, login/logout methods, and loading flags.
  - Local state (`useState`, `useReducer`) for diagnosis forms, multi-select symptom pickers, and history pagination.
- **HTTP Client:** Centralized Axios instance (`src/services/api.js`) with:
  - *Request Interceptor:* Injects `Authorization: Bearer <token>` into all outbound requests.
  - *Response Interceptor:* Intercepts 401 Unauthorized errors to automatically purge expired tokens and redirect to `/login`.
- **UX & Medical Safety:**
  - Mandatory disclaimer banners on every diagnosis result: *"This is an AI-assisted supportive triage tool, not a medical diagnosis. In an emergency, contact local emergency services immediately."*

### 3.2 API Gateway & Backend Architecture (`backend/`)
- **Runtime:** Node.js (ES Modules, `type: module`).
- **Framework:** Express.js with layered architecture:
  - `routes/`: Explicit URL endpoint routing.
  - `middleware/`: Authentication (`authMiddleware.js`), rate limiting (`rateLimiter.js`), security headers (`helmet`), error handler (`errorHandler.js`).
  - `controllers/`: Request extraction, validation result checking, and orchestration.
  - `services/`: Gemini prediction provider (`geminiService.js`), provider orchestrator with ML/heuristic fallback (`predictionService.js`), external ML HTTP bridge (`mlService.js`), and chat engine (`chatEngine.js`).
  - `models/`: Mongoose schemas and indexes.
  - `config/`: Database connection (`db.js`) and constants (`constants.js`).

### 3.3 ML Microservice Architecture (`ml-service/`)
- **Framework:** FastAPI / Python 3.10+.
- **Model:** Scikit-learn **Random Forest Classifier** trained on Kaggle Disease Prediction dataset.
- **Artifacts:**
  - `model.pkl`: Serialized trained ensemble estimator.
  - `symptoms.json`: Ordered list of 130+ symptom feature names.
  - `diseases.json`: Class labels and human-readable condition summaries.
- **Endpoints:**
  - `GET /health`: Liveness probe.
  - `GET /symptoms`: Returns the complete master list of searchable symptoms.
  - `POST /predict`: Accepts JSON `{ symptoms: ["headache", "fever"] }`, returns top-3 predictions with confidence percentages.

### 3.4 Data Layer Architecture (`MongoDB Atlas`)
- **Collections:**
  1. `users`: Authentication records, bcrypt-hashed credentials, optional demographic data (age, gender).
  2. `diagnoses`: Historical check-in records containing symptoms array, predicted disease, confidence score, top-3 candidates, and timestamps.
- **Indexing Strategy:**
  - `users.email`: Unique index.
  - `diagnoses.userId + diagnoses.createdAt`: Compound descending index for instant paginated history lookups (`{ userId: 1, createdAt: -1 }`).

---

## 4. End-to-End Sequence Diagrams

### 4.1 Diagnosis Prediction Workflow

```mermaid
sequenceDiagram
    autonumber
    actor User as Patient (Browser)
    participant FE as React Frontend
    participant API as Node.js Gateway
    participant DB as MongoDB Atlas
    participant Gemini as Google Gemini API (@google/genai)
    participant ML as Python ML Service

    User->>FE: Selects symptoms ["chills", "fever", "cough"] & clicks Diagnose
    FE->>FE: Validates >= 1 symptom selected
    FE->>API: POST /api/diagnosis/predict (Header: Bearer JWT)
    API->>API: authMiddleware verifies JWT signature
    API->>API: Validates body schema
    API->>Gemini: generateContent(gemini-3.6-flash, { symptoms, duration, discomfort }) — server-side GEMINI_API_KEY

    alt Gemini Healthy (< 12000ms)
        Gemini-->>API: Structured JSON assessment (schema-constrained)
        API->>API: Validate & clamp model output server-side
    else Gemini Unconfigured / Timeout / Rate Limit / Invalid / Outage
        API->>ML: POST http://ml-service:8000/predict { symptoms: [...] }

        alt ML Service Healthy (< 3000ms)
            ML->>ML: Multi-hot encodes symptoms vector
            ML->>ML: model.predict_proba() -> Top 3 conditions + confidence
            ML-->>API: 200 OK { primary: "Common Cold", confidence: 88.4, top3: [...] }
        else ML Service Timeout or Error
            API->>API: Trigger fallback heuristic engine
        end
    end

    API->>DB: Diagnosis.create({ userId, symptoms, prediction, confidence, ... })
    DB-->>API: Saved Document
    API-->>FE: 201 Created { success: true, data: diagnosisRecord, message: "..." }
    FE->>User: Displays Diagnosis Results, Confidence Gauges & Mandatory Medical Disclaimer
```

### 4.2 Authentication & Protected Route Workflow

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Patient
    participant FE as React App (Login.jsx)
    participant API as Express API (/api/auth/login)
    participant DB as MongoDB (Users)

    User->>FE: Inputs email & password
    FE->>API: POST /api/auth/login { email, password }
    API->>DB: User.findOne({ email })
    DB-->>API: User Record with hashed password
    API->>API: bcrypt.compare(password, user.password)
    
    alt Password Matches
        API->>API: jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' })
        API-->>FE: 200 OK { success: true, token, user: { name, email } }
        FE->>FE: AuthContext stores token & redirects to /dashboard
    else Invalid Password
        API-->>FE: 401 Unauthorized { success: false, message: "Invalid credentials" }
        FE->>User: Displays error alert
    end
```

---

## 5. Security & Threat Mitigation Architecture

| Threat / Vulnerability | Mitigation in Architecture |
|---|---|
| **Brute Force Login Attacks** | `express-rate-limit` configured on `/api/auth/*` (max 10 requests per 15 min window). |
| **Credential Exposure** | Passwords hashed with `bcryptjs` using 12 salt rounds; zero plaintext credentials stored or logged. |
| **Cross-Site Scripting (XSS)** | React JSX auto-escaping + `helmet` HTTP security headers (`Content-Security-Policy`, `X-XSS-Protection`). |
| **NoSQL Injection** | Mongoose strict schemas + input validation sanitizing query operators (`$gt`, `$ne`). |
| **Unauthorized Data Access** | All `/api/diagnosis/*` endpoints verify that `req.user._id` matches the document's `userId`. Users can never read another user's diagnosis records. |
| **Unauthenticated ML Access** | Python ML service runs on internal port / private network; only the Node.js API Gateway can reach it. |
| **Secret Leaks in Version Control** | Strict `.gitignore` rules + `.env.example` templates with empty dummy values. |

---

## 6. Resilience & Production Readiness

1. **Graceful Shutdown:** Express process traps `SIGINT` and `SIGTERM` to close database connections cleanly before exiting.
2. **Health Check Probes:**
   - Gateway: `GET /api/health` returns `{ status: "ok", service: "api-gateway", timestamp }`.
   - ML Service: `GET /health` returns `{ status: "ok", model_loaded: true, symptoms_count: 132 }`.
3. **Pagination Defense:** History endpoint `/api/diagnosis/history` enforces `page` and `limit` (max 50 items per page) to prevent unbounded memory allocation.
4. **Environment Integrity:** System checks for required environment variables (`MONGO_URI`, `JWT_SECRET`) on process initialization, failing fast if any are absent. Prediction provider configuration (`PREDICTION_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`) is validated at startup with non-fatal warnings — requests gracefully fall back to the ML/heuristic engine when Gemini is unconfigured.
