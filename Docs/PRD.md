# Online Health Diagnosis System
### Product Requirements Document (PRD) + Architecture + Rules + Documentation Plan
**Version:** 1.0
**Author:** Swapan
**Status:** Draft — Living document (update as you build)

> **Purpose of this document:** This is the single source of truth for the project. Whenever you (or an AI assistant) lose context on what's been decided, come back to this file first. Every major decision, rule, and structure is written here so nothing has to be re-derived from scratch.

---

## 1. Executive Summary

**Project Name:** MedInsight — Online Health Diagnosis System
*(placeholder name — feel free to rename; used consistently below)*

**One-line pitch:** A full-stack web application that lets users enter their symptoms and receive an AI-powered preliminary diagnosis prediction, backed by a secure authentication system, diagnosis history tracking, and a clean, professional UI — built to demonstrate production-grade full-stack + ML integration skills.

**Why this project matters for your resume:**
- Combines **3 disciplines** recruiters look for: Frontend (React), Backend (Node/Express + REST API design), and Applied ML (Python microservice) — most beginner portfolios only show one.
- Demonstrates **microservice architecture** (Node talking to a separate Python ML service) — a genuinely advanced/industry pattern, not just a CRUD app.
- Demonstrates **security fundamentals** (JWT auth, protected routes, input validation) — shows you think about real-world concerns, not just happy-path code.
- Is **explainable in an interview** end-to-end because you built every layer yourself.

**Target outcome:** A deployed, working, bug-free, well-documented project with a public GitHub repo + live demo link + a solid README that a recruiter or internship reviewer can understand in under 2 minutes.

---

## 2. Goals & Non-Goals

### 2.1 Goals (MVP — must have)
- User can register/login securely (JWT-based auth).
- User can enter symptoms (via checklist or free text mapped to known symptoms) and get a predicted disease/condition with a confidence score.
- User can view their past diagnosis history.
- Basic health info page shown for the predicted condition (description + "consult a doctor" disclaimer).
- Fully responsive UI (mobile + desktop).
- Deployed live (not just "works on my machine").
- Clean, professional README + architecture diagram in the repo.

### 2.2 Stretch Goals (only after MVP is 100% done and stable)
- Doctor–patient appointment booking module.
- PDF export of diagnosis report.
- Admin dashboard (view usage stats, manage symptom/disease dataset).
- Multi-language symptom input.
- Chatbot-style symptom collection (conversational UI) instead of a static form.
- Email notification on diagnosis completion.

### 2.3 Explicit Non-Goals (do NOT attempt — scope creep kills beginner projects)
- This is **not** a real medical diagnostic tool. It must **never** claim clinical accuracy. A visible disclaimer is mandatory everywhere a prediction is shown.
- No real patient data (HIPAA/DPDP compliance) — use synthetic/public datasets only.
- No payment/insurance integration.
- No mobile native app (web-responsive is enough).

---

## 3. User Roles

| Role | Capabilities |
|---|---|
| **Guest** | View landing page, register, login |
| **User (Patient)** | Login, submit symptoms, view own diagnosis history, edit own profile |
| **Admin** *(stretch goal only)* | View all users' aggregated (anonymized) stats, manage disease/symptom dataset |

---

## 4. Functional Requirements

### 4.1 Authentication Module
- FR-1: User can register with name, email, password (hashed with bcrypt).
- FR-2: User can log in and receive a JWT (short-lived access token; consider refresh token for advanced credit).
- FR-3: Passwords must be validated (min 8 chars, at least one number) on both frontend and backend.
- FR-4: All diagnosis/profile routes must be protected — reject requests without a valid JWT (401).
- FR-5: Logout clears token client-side.

### 4.2 Symptom Checker / Diagnosis Module
- FR-6: User selects symptoms from a searchable multi-select list (NOT free text initially — free text NLP is a stretch goal, adds huge complexity for a beginner).
- FR-7: On submit, frontend sends symptom list to backend → backend forwards to Python ML service → ML service returns predicted disease + confidence score(s) for top 3 possibilities.
- FR-8: Backend saves the diagnosis result (symptoms, prediction, confidence, timestamp, userId) to MongoDB.
- FR-9: Result page shows: predicted condition, confidence %, short description, and a **mandatory disclaimer**: "This is not a medical diagnosis. Please consult a certified doctor."

### 4.3 Diagnosis History Module
- FR-10: User can view a list of all their past diagnoses, sorted by date (newest first).
- FR-11: User can click into a past diagnosis to see full detail.
- FR-12: (Stretch) User can delete a history entry.

### 4.4 Profile Module
- FR-13: User can view/edit name, email (with re-verification if changed), age, gender (optional fields relevant to symptom accuracy).

---

## 5. Non-Functional Requirements (this is what makes it "advanced")

| Category | Requirement |
|---|---|
| **Security** | Passwords hashed (bcrypt, salt rounds ≥10). JWT secret in `.env`, never hardcoded. Helmet.js for HTTP headers. Rate-limiting on auth routes (express-rate-limit) to prevent brute force. Input sanitization (express-validator) against injection. CORS configured explicitly (not `*`). |
| **Performance** | API response time target < 500ms for CRUD ops, <2s for ML prediction call. Pagination on history endpoint (don't return unbounded lists). |
| **Reliability** | Backend must handle ML service downtime gracefully (try/catch + fallback error message, not a crash). |
| **Code Quality** | ESLint + Prettier configured. Consistent folder structure (below). Meaningful commit messages (conventional commits). |
| **Testing** | At least basic unit tests for auth logic and ML prediction endpoint (Jest for Node, pytest for Python). This alone puts you ahead of 90% of beginner projects. |
| **Documentation** | README, API docs (Postman collection or Swagger), architecture diagram, `.env.example`. |
| **Deployment** | Frontend on Vercel/Netlify, Backend on Render/Railway, ML service on Render (separate service), MongoDB Atlas for DB. |
| **Accessibility** | Basic a11y — proper labels on form inputs, sufficient color contrast, keyboard-navigable forms. |

---

## 6. System Architecture

### 6.1 High-Level Architecture (3-tier + ML microservice)

```
┌─────────────────┐        HTTPS/JSON       ┌──────────────────────┐
│   React Frontend │ ───────────────────────▶ │   Node/Express API   │
│  (Vercel hosted)  │ ◀─────────────────────── │   (Render hosted)    │
└─────────────────┘                           └──────────┬───────────┘
                                                          │ internal HTTP call
                                                          │ (POST /predict)
                                              ┌───────────▼────────────┐
                                              │  Python ML Service      │
                                              │  (Flask/FastAPI)        │
                                              │  (Render hosted)        │
                                              └───────────┬────────────┘
                                                          │
                                              ┌───────────▼────────────┐
                                              │   model.pkl (trained)   │
                                              └─────────────────────────┘

                              ┌────────────────────────┐
Node/Express API  ───────────▶│   MongoDB Atlas          │
                              │  (Users, Diagnoses)      │
                              └────────────────────────┘
```

**Why this architecture (be ready to explain in interviews):**
- Separating the ML service from the Node backend mirrors real industry pattern (polyglot microservices) — Node is bad at ML, Python is bad at high-concurrency web serving, so each does what it's best at.
- The Node API is the single entry point (API Gateway pattern) — frontend never talks to the ML service directly, which keeps the ML service unauthenticated-safe and swappable later.

### 6.2 Folder Structure

```
health-diagnosis-system/
├── frontend/                    # React + Tailwind
│   ├── src/
│   │   ├── components/          # Navbar, ProtectedRoute, SymptomSelector, ResultCard
│   │   ├── pages/                # Login, Register, Dashboard, SymptomChecker, History, Profile
│   │   ├── context/              # AuthContext.jsx (JWT + user state)
│   │   ├── services/              # api.js (Axios instance with interceptors)
│   │   ├── utils/                 # validators.js
│   │   └── App.jsx
│   ├── .env.example
│   └── package.json
│
├── backend/                      # Node + Express
│   ├── models/                   # User.js, Diagnosis.js
│   ├── routes/                    # authRoutes.js, diagnosisRoutes.js, userRoutes.js
│   ├── controllers/                # authController.js, diagnosisController.js, userController.js
│   ├── middleware/                  # authMiddleware.js, errorHandler.js, rateLimiter.js
│   ├── config/                       # db.js
│   ├── utils/                          # validators.js, apiResponse.js
│   ├── tests/                            # auth.test.js, diagnosis.test.js
│   ├── .env.example
│   ├── server.js
│   └── package.json
│
├── ml-service/                    # Python
│   ├── data/                       # dataset.csv (public/synthetic symptom-disease dataset)
│   ├── model/
│   │   ├── train.py                # training script
│   │   └── model.pkl                # saved trained model
│   ├── app.py                        # Flask/FastAPI app exposing POST /predict
│   ├── requirements.txt
│   └── tests/
│       └── test_predict.py
│
├── docs/
│   ├── PRD.md                     ← this file
│   ├── API.md                      # endpoint documentation
│   ├── ARCHITECTURE.md              # diagrams + explanation
│   ├── ERD.png                       # database schema diagram
│   └── postman_collection.json
│
├── .gitignore
├── README.md
└── docker-compose.yml              # (stretch — optional, big resume plus)
```

### 6.3 Database Schema (MongoDB)

**User**
```
{
  _id, name, email (unique), password (hashed),
  age, gender, createdAt
}
```

**Diagnosis**
```
{
  _id, userId (ref: User), symptoms: [String],
  predictedDisease: String, confidence: Number,
  topPredictions: [{ disease, confidence }],
  createdAt
}
```

### 6.4 API Endpoints (contract — do not deviate without updating docs/API.md)

| Method | Endpoint | Auth? | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/users/me` | Yes | Get logged-in user profile |
| PUT | `/api/users/me` | Yes | Update profile |
| GET | `/api/symptoms` | Yes | Get list of available symptoms for the UI selector |
| POST | `/api/diagnosis/predict` | Yes | Submit symptoms → get + save prediction |
| GET | `/api/diagnosis/history` | Yes | Get paginated diagnosis history |
| GET | `/api/diagnosis/:id` | Yes | Get one diagnosis detail |
| DELETE | `/api/diagnosis/:id` | Yes | Delete a diagnosis (stretch) |

**Internal only (not exposed to frontend):**
| Method | Endpoint | Description |
|---|---|---|
| POST | `http://ml-service/predict` | Node → ML service internal call |

### 6.5 ML Model Approach (beginner-friendly but "advanced-looking")
- **Dataset:** Use a public symptom-disease dataset (e.g., Kaggle "Disease Prediction Using Machine Learning" dataset — ~130 symptoms mapped to ~40 diseases). Cite the dataset source in your README.
- **Model:** Start with a simple, explainable model — **Decision Tree** or **Random Forest** (scikit-learn). Easy to train, easy to explain, decent accuracy on this kind of dataset. Do NOT jump to deep learning — it adds complexity without meaningfully improving this classification task, and it hurts your ability to explain it in interviews.
- **Pipeline:** symptoms (multi-hot encoded vector) → model → predicted class + `predict_proba()` for confidence scores.
- **Evaluation:** Report accuracy, precision/recall, and a confusion matrix in `docs/ML_REPORT.md` — this single artifact massively boosts perceived rigor.

---

## 7. Engineering Rules (follow these strictly — this is what prevents "beginner bugs")

1. **Never commit secrets.** `.env` files are always in `.gitignore`. Only commit `.env.example` with placeholder values.
2. **Never trust frontend input on the backend.** Always re-validate on the server even if the frontend already validated.
3. **One feature branch per feature.** `feature/auth`, `feature/symptom-checker`, etc. Never commit directly to `main`. Merge via PR even if solo — write a real PR description; it's a resume artifact too.
4. **Commit early, commit often, with meaningful messages.** Use Conventional Commits format: `feat: add JWT auth middleware`, `fix: handle ML service timeout`.
5. **Handle every async call's error state.** Every `try/catch`, every Axios call must handle failure — no unhandled promise rejections.
6. **Consistent API response shape.** Always return `{ success: boolean, data, message }` from every endpoint — makes frontend error handling predictable.
7. **No magic numbers/strings.** Put constants (JWT expiry, salt rounds, pagination size) in a `config/constants.js`.
8. **Loading and error states in every UI component that fetches data.** No blank screens while waiting or on failure.
9. **Write the README last, but write it well.** Include: problem statement, tech stack, architecture diagram, setup instructions, screenshots/GIF demo, live link, and **limitations** (mentioning limitations honestly signals seniority, not weakness).
10. **Test the unhappy path.** Wrong password, expired token, ML service down, empty symptom list — all must be tested manually before calling a feature "done."
11. **Don't scope-creep before MVP is fully working end-to-end.** Get the thinnest possible full-stack slice working first (register → login → submit 1 symptom → get 1 prediction → see it in history), THEN improve each piece.

---

## 8. Required Documentation (create these — each is also a resume talking point)

| Doc | Purpose | Priority |
|---|---|---|
| `README.md` | Main entry point — problem, stack, setup, demo | **Critical** |
| `docs/PRD.md` | This document | Done |
| `docs/ARCHITECTURE.md` | Diagram + explanation of each service | High |
| `docs/API.md` | Every endpoint, request/response examples | High |
| `docs/ERD.png` (or .drawio) | Database schema diagram | Medium |
| `docs/ML_REPORT.md` | Dataset used, model choice, accuracy metrics, confusion matrix | High — this is your ML credibility proof |
| `postman_collection.json` | Exportable API test collection | Medium |
| `.env.example` (frontend + backend) | Required env vars, no real secrets | **Critical** |
| `CHANGELOG.md` | (Stretch) Track version history | Low |

---

## 9. Suggested Build Order (do NOT build frontend and backend fully in parallel as a beginner — it causes context-switching bugs)

1. **Setup week:** Init repo, folder structure, `.gitignore`, README skeleton, MongoDB Atlas cluster, basic Express server with a health-check route (`GET /api/health`).
2. **Auth slice (backend):** User model, register/login routes, JWT middleware. Test entirely via Postman before touching frontend.
3. **Auth slice (frontend):** Register/Login pages, AuthContext, protected routes. Connect to backend.
4. **ML service (standalone):** Get the dataset, train the model in a notebook/script, wrap it in a minimal Flask/FastAPI `/predict` endpoint. Test it standalone with `curl`/Postman — no Node involved yet.
5. **Diagnosis slice (backend):** Diagnosis model, `/predict` route that calls the ML service internally, `/history` route.
6. **Diagnosis slice (frontend):** Symptom selector UI → result page → history page.
7. **Polish pass:** Error handling, loading states, validation messages, responsive design pass.
8. **Testing pass:** Write the Jest/pytest tests from section 5.
9. **Docs pass:** Write all docs in section 8.
10. **Deploy:** Backend + ML service to Render, frontend to Vercel, MongoDB Atlas already cloud-hosted. Update README with live links.
11. **Final QA pass:** Walk through every user flow fresh, as if you're a stranger. Fix anything confusing or broken.

---

## 10. Definition of Done (for the whole project)

- [ ] All FR-1 through FR-13 implemented and manually tested
- [ ] All NFRs in section 5 satisfied
- [ ] Zero console errors/warnings in frontend or backend logs during normal use
- [ ] Deployed and reachable via public URLs
- [ ] All docs in section 8 exist and are accurate
- [ ] README has a working demo GIF/screenshots
- [ ] Disclaimer visible on every diagnosis result
- [ ] Code pushed to GitHub with clean commit history and no secrets in history

---

*Keep this file updated as decisions change. If you (or an assistant) ever lose track of project state, re-read this file top to bottom before making further decisions.*