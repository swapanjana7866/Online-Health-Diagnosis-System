# Carepath / MedInsight — Engineering Rules & Non-Negotiables

**Document Version:** 1.0  
**Authority:** Mandatory across all development, pull requests, and automated agents.

---

## 1. The 11 Core Engineering Rules

These rules are strictly enforced across the entire codebase. Violations will result in blocked pull requests.

### Rule 1: Zero Secrets in Version Control
- **Rule:** Never commit `.env` files, API keys, JWT secrets, database connection strings, or service tokens into Git.
- **Enforcement:** `.env` and `.env.local` must remain in `.gitignore`. Provide documented `.env.example` files with descriptive placeholder strings for every service (`backend/.env.example`, `frontend/.env.example`, `ml-service/.env.example`).

### Rule 2: Never Trust Frontend Input (Zero Trust API)
- **Rule:** Every client payload must be validated and sanitized on the backend, regardless of client-side validation.
- **Enforcement:**
  - Node.js API: Use `express-validator` or robust schema validation for every POST, PUT, and query parameter.
  - Python ML Service: Use Pydantic schemas (`BaseModel`) to validate typing, min/max bounds, and non-empty arrays.
  - Reject malformed requests immediately with HTTP 400 and clear error messages.

### Rule 3: Single Feature Branch & PR Discipline
- **Rule:** Never commit directly to `main`.
- **Enforcement:**
  - Create feature branches following the naming standard: `feature/<feature-name>` (e.g., `feature/jwt-auth`, `feature/symptom-selector`, `feature/ml-inference`).
  - Use `fix/<bug-name>` for bug fixes and `docs/<topic>` for documentation.
  - Every merge requires an explicit PR review, even in solo projects (serves as a portfolio review artifact).

### Rule 4: Conventional Commits
- **Rule:** All Git commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.
- **Format:** `<type>(<optional scope>): <imperative description>`
- **Permitted Types:**
  - `feat:` A new feature for the user
  - `fix:` A bug fix
  - `docs:` Documentation-only changes
  - `refactor:` Code restructuring without changing external behavior
  - `style:` Formatting, missing semicolons, CSS alignment
  - `test:` Adding or updating tests
  - `chore:` Dependency updates, build configs
- **Examples:**
  - `feat(auth): implement bcrypt password hashing and JWT token issuance`
  - `fix(ml-service): handle unknown symptom strings gracefully without 500 error`

### Rule 5: Exhaustive Async Error Handling
- **Rule:** No unhandled promise rejections or unhandled exceptions anywhere in the stack.
- **Enforcement:**
  - Node.js: Every route handler must use async error wrappers or explicit `try/catch` passing errors to `next(error)`.
  - Python: Use FastAPI exception handlers and try/except blocks around model loading and inference.
  - React: Every Axios/fetch call must catch errors, set error state, and render accessible user feedback.

### Rule 6: Unified API Response Envelope
- **Rule:** All API endpoints must return a consistent JSON response shape.
- **Specification:**
  ```json
  // Success Response (HTTP 200 / 201)
  {
    "success": true,
    "message": "Diagnosis created successfully",
    "data": { ... },
    "error": null
  }

  // Error Response (HTTP 400 / 401 / 403 / 404 / 500)
  {
    "success": false,
    "message": "Invalid credentials provided",
    "data": null,
    "error": {
      "code": "AUTH_INVALID_CREDENTIALS",
      "details": [...]
    }
  }
  ```
- No raw arrays or bare primitives returned directly from the root response.

### Rule 7: Zero Magic Numbers and Magic Strings
- **Rule:** Hardcoded constants (such as token expiration intervals, pagination page sizes, salt rounds, port defaults, and severity levels) are prohibited in business logic.
- **Enforcement:** Place all constants into dedicated configuration files:
  - Backend: `backend/config/constants.js`
  - Frontend: `frontend/src/utils/constants.js`
  - ML: `ml-service/config.py`

### Rule 8: Comprehensive UI State Triad (Loading, Error, Empty)
- **Rule:** Any UI component that loads asynchronous data must handle and visually represent all three states:
  1. **Loading State:** Smooth spinner, skeleton loader, or pulse animation. Never leave a blank page.
  2. **Error State:** Human-readable error banner with a "Retry" button.
  3. **Empty State:** Friendly guidance when records don't exist (e.g., "No diagnosis history found. Start your first health check-in!").

### Rule 9: Mandatory Medical Disclaimer
- **Rule:** A clear, visible, non-dismissible medical disclaimer must be displayed on every screen where health analysis or symptom diagnosis is presented.
- **Text Requirement:**
  > *"MedInsight provides preliminary, AI-assisted symptom triage guidance for informational purposes only. It is not a clinical medical diagnosis. In case of emergency or severe discomfort, please consult a certified doctor or contact your local emergency services immediately."*

### Rule 10: Unhappy Path Testing Verification
- **Rule:** A feature is not considered "done" if only the happy path has been tested.
- **Required Unhappy Path Tests:**
  - Expired or malformed JWT token
  - Incorrect password or non-existent email
  - Empty symptom array submission
  - Downed ML service simulation (verifying graceful fallback)
  - Duplicate email registration

### Rule 11: No Scope Creep Before MVP Baseline
- **Rule:** Do not start stretch features (such as doctor appointment booking, PDF generation, or chatbot interfaces) until the foundational MVP end-to-end slice is 100% complete, tested, and deployed.
- **Sequence:** Auth -> Standalone ML Service -> Gateway Integration -> Polished Frontend UI -> Testing & Deployment.
