# Phase 6 Goal: Automated Testing & Code Quality Suite

**Phase ID:** `phase-6-testing-qa`  
**Status:** Ready to Start  
**Prerequisites:** Phase 3 (Diagnosis Backend), Phase 5 (Security)  

---

## 1. Objective
Establish an automated testing foundation across both the Node.js API Gateway and Python ML microservice using Jest, Supertest, and Pytest. Validate both happy and unhappy paths to ensure bulletproof reliability and demonstrate high engineering maturity to recruiters.

---

## 2. Scope & Deliverables

### In Scope
- **Backend API Tests (Jest + Supertest in `backend/tests/`):**
  - `auth.test.js`:
    - Register new user successfully (201).
    - Reject registration if email already exists (400).
    - Reject registration if password is < 8 characters or lacks a digit (400).
    - Login with valid credentials and verify JWT format (200).
    - Reject login with incorrect password (401).
    - Access `/api/users/me` with valid vs. missing/tampered JWT (200 vs. 401).
  - `diagnosis.test.js`:
    - Submit valid symptoms and verify document creation (201).
    - Reject diagnosis request with empty symptoms array (400).
    - Retrieve paginated history and verify sorting (newest first).
    - Prevent User B from viewing or deleting User A's diagnosis record (403/404).
- **ML Microservice Tests (Pytest in `ml-service/tests/`):**
  - `test_predict.py`:
    - Test health check `GET /health` returns 200 and `model_loaded: true`.
    - Test prediction with recognized symptoms returns valid top-3 predictions and confidence score $\in [0, 100]$.
    - Test prediction with unrecognized symptoms strips them gracefully.
    - Test empty symptoms array triggers HTTP 422 validation error.
- **Code Quality & Linting:**
  - Configure ESLint + Prettier in both frontend and backend directories.
  - Ensure zero ESLint errors across the codebase.

### Out of Scope
- End-to-end browser automation tests (Cypress/Playwright) for MVP (deferred to Phase 9).

---

## 3. Test Execution Commands

```bash
# Run backend API test suite
cd backend
npm test

# Run ML service pytest suite
cd ml-service
pytest tests/ -v
```

---

## 4. Definition of Done (DoD) Checklist
- [ ] All Jest integration tests pass against an in-memory or test MongoDB database.
- [ ] Pytest suite achieves 100% pass rate across normal, edge, and invalid inputs.
- [ ] Both happy and unhappy paths (wrong password, expired token, malformed payload) are verified in tests.
- [ ] `npm run lint` finishes with zero errors or warnings.
- [ ] Test execution commands are documented in `README.md`.

---

## 5. Interview / Resume Talking Points
> *"In Phase 6, I built a comprehensive multi-service automated testing suite. Most junior portfolios have zero tests; MedInsight features integration tests using Jest and Supertest for the API Gateway and Pytest for the Python ML service. Crucially, I tested unhappy paths—verifying unauthorized token rejection, duplicate user defense, and microservice payload boundary conditions."*
