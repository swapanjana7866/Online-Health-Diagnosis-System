# Carepath: Online Health Diagnosis System

A full-stack health check-in application built with React, Express, MongoDB, and JWT authentication.

## Run locally

1. Copy `backend/.env.example` to `backend/.env` and set `MONGO_URI` and `JWT_SECRET`.
2. Install and start the API:

```bash
cd backend
npm install
npm run dev
```

3. In a second terminal, install and start the frontend:

```bash
cd frontend
npm install
npm run dev
```


## Architecture, Rules & Roadmap Documentation

All engineering guidelines, system architecture diagrams, and phased milestones are documented in [`Docs/`](file:///e:/Online-Health-Diagnosis-System/Docs):

- **[Product Requirements Document (PRD)](file:///e:/Online-Health-Diagnosis-System/Docs/PRD.md)**: Product vision, user stories, and specifications.
- **[System Architecture](file:///e:/Online-Health-Diagnosis-System/Docs/ARCHITECTURE.md)**: 3-tier polyglot microservice topology, data flows, and security design.
- **[Engineering Rules & Non-Negotiables](file:///e:/Online-Health-Diagnosis-System/Docs/RULES.md)**: 11 core non-negotiables for the project.
- **[Coding Standards & Best Practices](file:///e:/Online-Health-Diagnosis-System/Docs/CODING_STANDARDS.md)**: React, Node, Python FastAPI, and MongoDB guidelines.
- **[Master Roadmap & Phase Goals](file:///e:/Online-Health-Diagnosis-System/Docs/GOALS.md)**: Milestone tracking and per-phase `goal.md` files (Phases 0 through 9).

The symptom check-in provides supportive triage guidance only. It is not a medical diagnosis and does not replace professional care or emergency services.

