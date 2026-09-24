# Phase 3 Goal: Core Diagnosis Engine (Backend Gateway & Persistence)

**Phase ID:** `phase-3-diagnosis-backend`  
**Status:** Ready to Start  
**Prerequisites:** Phase 1 (Auth), Phase 2 (ML Service)  

---

## 1. Objective
Integrate the Node.js API Gateway with the Python ML microservice and MongoDB Atlas. Implement the complete diagnosis lifecycle: symptom validation, secure inter-service HTTP communication with timeout resilience, MongoDB persistence with compound indexing, and paginated historical retrieval.

---

## 2. Scope & Deliverables

### In Scope
- **Mongoose `Diagnosis` Schema:**
  - `userId`: ObjectId reference to `User` (indexed).
  - `symptoms`: Array of non-empty strings.
  - `predictedDisease`: String.
  - `confidence`: Number (percentage, 0-100).
  - `topPredictions`: Array of `{ disease: String, confidence: Number }`.
  - `notes`: Optional patient notes.
  - `isFallback`: Boolean flag indicating if fallback triage was used.
  - Timestamps: `createdAt`, `updatedAt`.
  - Compound index: `{ userId: 1, createdAt: -1 }`.
- **Internal Service Bridge (`backend/services/mlService.js`):**
  - Axios or native fetch with an explicit **3000ms timeout**.
  - Fallback mechanism: If ML service fails or times out, calculate heuristic guidance so the user request succeeds.
- **REST Endpoints (`backend/routes/diagnosisRoutes.js`):**
  - `GET /api/symptoms`: Retrieves master list of selectable symptoms (cached in Node memory).
  - `POST /api/diagnosis/predict`: Submits symptoms, calls ML service, saves record, returns result.
  - `GET /api/diagnosis/history`: Returns paginated history (`page`, `limit`) for the authenticated user.
  - `GET /api/diagnosis/:id`: Returns full details of a specific diagnosis, verifying user ownership.
  - `DELETE /api/diagnosis/:id`: Deletes a specific diagnosis record.

### Out of Scope
- Frontend UI rendering (deferred to Phase 4).
- PDF report generation (deferred to Phase 9).

---

## 3. Technical Specification & API Contracts

### 3.1 Submit Diagnosis (`POST /api/diagnosis/predict`)
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "symptoms": ["chills", "high_fever", "cough"],
    "notes": "Feeling sick since yesterday evening"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Diagnosis evaluated and saved successfully",
    "data": {
      "id": "64b8f72a1e...",
      "symptoms": ["chills", "high_fever", "cough"],
      "predictedDisease": "Common Cold",
      "confidence": 84.5,
      "topPredictions": [
        { "disease": "Common Cold", "confidence": 84.5 },
        { "disease": "Pneumonia", "confidence": 10.2 }
      ],
      "disclaimer": "This is an AI-assisted supportive triage tool, not a medical diagnosis.",
      "createdAt": "2026-09-11T12:30:00.000Z"
    },
    "error": null
  }
  ```

### 3.2 Paginated History (`GET /api/diagnosis/history?page=1&limit=10`)
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "History retrieved successfully",
    "data": {
      "diagnoses": [...],
      "pagination": {
        "total": 24,
        "page": 1,
        "limit": 10,
        "totalPages": 3
      }
    },
    "error": null
  }
  ```

---

## 4. Definition of Done (DoD) Checklist
- [ ] Mongoose schema validates required fields and enforces `{ userId: 1, createdAt: -1 }` index.
- [ ] `POST /api/diagnosis/predict` successfully calls Python ML service and persists document.
- [ ] Simulating an ML microservice crash triggers the fallback mechanism without failing the API request.
- [ ] A user cannot access or delete another user's diagnosis record (enforces 403 / 404 security checks).
- [ ] History query uses `.lean()` and pagination limits (max 50 records per request).

---

## 5. Interview / Resume Talking Points
> *"In Phase 3, I implemented an API Gateway integration with circuit-breaker resilience. When connecting the Express API to the Python ML microservice, I configured an explicit 3000ms timeout with a fallback engine. This ensures that even during ML service cold-starts or network blips, the user receives helpful triage advice rather than an unhandled 500 error."*
