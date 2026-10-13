# Carepath: Online Health Diagnosis System

A full-stack health check-in application built with React, Express, MongoDB, and JWT authentication.

## Run locally

1. Copy `backend/.env.example` to `backend/.env` and set `MONGO_URI` and `JWT_SECRET`.
2. Create a Google Gemini API key at [Google AI Studio](https://aistudio.google.com/apikey) and set `GEMINI_API_KEY` in `backend/.env`; the key stays server-side only and is never exposed to the frontend. The predicted condition is always grounded by the Python ML microservice (validated SymptomDiseaseClassifier) with the local heuristic overlap engine as fallback — with `PREDICTION_PROVIDER=gemini` (default), Gemini additionally **explains the candidate conditions** (supporting/missing symptoms, self-care, warning signs) and degrades gracefully to local rule-based explanations without a key. Set `PREDICTION_PROVIDER=ml` to disable external Gemini calls entirely, and optionally override the model with `GEMINI_MODEL` (default: `gemini-3.6-flash`, a current stable Gemini Flash model).
3. In the frontend, copy `frontend/.env.example` to `frontend/.env`. Set `VITE_API_URL` to the API URL and port the backend is using (default: `http://localhost:5000`).
4. Install and start the API:

```bash
cd backend
npm install
npm run dev
```

5. In a second terminal, install and start the frontend:

```bash
cd frontend
npm install
npm run dev
```

In local development, Vite proxies `/api` requests to `VITE_API_URL`, avoiding browser CORS issues. If the backend starts on a different port because port `5000` is busy, update `VITE_API_URL` in `frontend/.env` to match the backend's listening port and restart the frontend. You can verify the backend at `http://localhost:5000/api/health` (replace the port if needed).

## Architecture, Rules & Roadmap Documentation

All engineering guidelines, system architecture diagrams, and phased milestones are documented in [`Docs/`](Docs/):

- **[Product Requirements Document (PRD)](Docs/PRD.md)**: Product vision, user stories, and specifications.
- **[System Architecture](Docs/ARCHITECTURE.md)**: 3-tier polyglot microservice topology, data flows, and security design.
- **[Engineering Rules & Non-Negotiables](Docs/RULES.md)**: 11 core non-negotiables for the project.
- **[Coding Standards & Best Practices](Docs/CODING_STANDARDS.md)**: React, Node, Python FastAPI, and MongoDB guidelines.
- **[Master Roadmap & Phase Goals](Docs/GOALS.md)**: Milestone tracking and per-phase `goal.md` files (Phases 0 through 9).

The symptom check-in provides supportive triage guidance only. It is not a medical diagnosis and does not replace professional care or emergency services.
