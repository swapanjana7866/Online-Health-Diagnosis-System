# Carepath / MedInsight — Coding Standards & Best Practices

**Document Version:** 1.0  
**Scope:** Frontend (React), Backend (Node/Express), ML Microservice (Python/FastAPI), Database (MongoDB/Mongoose).

---

## 1. Frontend Development Standards (React + Vite)

### 1.1 Project Structure & File Organization
```
frontend/src/
├── assets/         # Static images, icons, logos
├── components/     # Reusable, stateless or semi-stateless UI components
│   ├── common/     # Button, Input, Modal, Badge, Spinner, Alert
│   ├── layout/     # Navbar, Footer, Sidebar, Container
│   └── diagnosis/  # SymptomSelector, ResultCard, HistoryCard, DisclaimerBanner
├── context/        # React Context providers (AuthContext.jsx, ThemeContext.jsx)
├── hooks/          # Custom hooks (useAuth.js, useFetch.js, useDebounce.js)
├── pages/          # Full page views mapped to router paths (Login, Register, Dashboard, History, Profile)
├── routes/         # ProtectedRoute.jsx, AppRouter.jsx
├── services/       # Centralized API network layer (api.js, authService.js, diagnosisService.js)
├── utils/          # Pure helper functions, formatting, validation rules, constants
└── styles/         # Global styles and Tailwind configuration
```

### 1.2 Component Architecture & React Best Practices
1. **Functional Components with Hooks Only:** No class components. Always use functional components with standard React hooks (`useState`, `useEffect`, `useCallback`, `useMemo`).
2. **Explicit Props Destructuring & Defaults:**
   ```jsx
   // Good
   export const ResultCard = ({ condition, confidence = 0, summary, isEmergency = false }) => { ... };
   ```
3. **Avoid State Duplication:** Compute values inline or with `useMemo` where possible rather than storing redundant derived state in `useState`.
4. **Custom Hooks for Shared Logic:** Encapsulate API data fetching, form handling, or authentication checks in clean custom hooks (e.g., `useAuth()`).
5. **No Inline Anonymous Arrow Functions in Props If Heavy:** Use `useCallback` for functions passed down to memoized children to prevent unnecessary re-renders.

### 1.3 Centralized Network Layer & Interceptors
- All outbound HTTP requests must go through `src/services/api.js`. Never call raw `fetch()` or instantiate standalone `axios` in individual components.
- **Request Interceptor:** Automatically attach `Authorization: Bearer ${token}`.
- **Response Interceptor:** Gracefully handle global HTTP error codes:
  ```javascript
  api.interceptors.response.use(
    (response) => response.data,
    (error) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      return Promise.reject(error.response?.data || { message: 'Network error' });
    }
  );
  ```

### 1.4 Accessibility (a11y) & UX Standards
- **Form Controls:** Every `<input>`, `<select>`, and `<textarea>` must have an associated `<label>` or explicit `aria-label`.
- **Keyboard Navigation:** Modals and dropdowns must support keyboard focus trapping and `Escape` key dismissals.
- **Color Contrast:** All text must meet WCAG AA standards (minimum 4.5:1 contrast ratio against backgrounds).
- **Responsive Layout:** Mobile-first approach using flexbox and grid; all screens must be verified at 375px (mobile), 768px (tablet), and 1280px (desktop).

---

## 2. Backend Development Standards (Node.js & Express)

### 2.1 Layered Architecture Pattern
Code must flow cleanly through strict boundaries:
```
Request -> Route -> Middleware -> Controller -> Service -> Model -> Database
```
- **Routes:** Map HTTP paths and verbs to validation chains and controller methods. No business logic in route files.
- **Middleware:** Cross-cutting concerns (authentication, request validation, rate limiting, request logging).
- **Controllers:** Parse request parameters, verify validation results, call services or models, and send standardized responses.
- **Services (Optional / For Complex Operations):** Orchestration (e.g., communicating with the Python ML service, generating reports).
- **Models:** Mongoose schemas, hooks, indexes, and custom schema methods.

### 2.2 Standardized Controller & Response Pattern
All controller methods must use the centralized `apiResponse` helper:

```javascript
// utils/apiResponse.js
export const sendSuccess = (res, statusCode = 200, message = 'Success', data = null) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    error: null
  });
};

export const sendError = (res, statusCode = 400, message = 'Error', details = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data: null,
    error: details
  });
};
```

### 2.3 Input Validation with Express-Validator
Never access `req.body` directly in controller logic without prior schema validation:
```javascript
// routes/authRoutes.js
import { body } from 'express-validator';
import { validate } from '../middleware/validateMiddleware.js';

router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).matches(/\d/).withMessage('Password must be at least 8 characters and contain a number'),
    validate
  ],
  registerController
);
```

### 2.4 Error Handling Middleware
A centralized error handler at the end of the Express middleware pipeline catches all unhandled exceptions:
```javascript
// middleware/errorHandler.js
export const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  if (process.env.NODE_ENV !== 'production') {
    console.error('SERVER ERROR:', err.stack);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    data: null,
    error: process.env.NODE_ENV === 'production' ? null : { stack: err.stack }
  });
};
```

---

## 3. Machine Learning Service Standards (Python & FastAPI)

### 3.1 Pydantic Validation & Typing
All request and response structures must use typed Pydantic models:
```python
# ml-service/schemas.py
from pydantic import BaseModel, Field
from typing import List, Optional

class PredictRequest(BaseModel):
    symptoms: List[str] = Field(..., min_items=1, description="List of recorded patient symptoms")
    patient_age: Optional[int] = Field(None, ge=0, le=120)
    gender: Optional[str] = Field(None, regex="^(male|female|other)$")

class DiseaseConfidence(BaseModel):
    disease: str
    confidence: float

class PredictResponse(BaseModel):
    success: bool
    predicted_disease: str
    confidence: float
    top_predictions: List[DiseaseConfidence]
    disclaimer: str
```

### 3.2 Model Persistence & Memory Lifecycle
- Load `model.pkl` and metadata vectors **once** during FastAPI application startup (`@app.on_event("startup")` or lifespan context manager).
- Never reload model weights from disk during a request handler.
- Cache the symptom feature list into an internal dictionary or set for $O(1)$ feature lookup during vectorization.

### 3.3 Vectorization Hygiene
- Unknown symptoms from user input must be sanitized and ignored rather than raising a `KeyError` or crashing the service.
- If zero valid symptoms match the dictionary after sanitization, the service must return a clean 422 Unprocessable Entity with helpful diagnostics, rather than evaluating an empty zero-vector.

---

## 4. Database & Mongoose Standards (MongoDB)

### 4.1 Schema Definition & Validation
- Always set `{ timestamps: true }` on every Mongoose schema.
- Define explicit validation rules (`required: true`, `trim: true`, `lowercase: true`).
- Use Mongoose `pre('save')` hooks for password hashing only when modified (`isModified('password')`).

### 4.2 Query Optimization & Indexing
- Always build indexes for foreign keys and queries involving sorting:
  ```javascript
  diagnosisSchema.index({ user: 1, createdAt: -1 });
  ```
- Use `.lean()` on queries where documents are only read and not modified with Mongoose instance methods. This reduces memory consumption and speeds up JSON serialization.
- Enforce pagination limits using `.skip()` and `.limit()` on historical lookups.

---

## 5. Security & Environment Standards

1. **Password Security:** Use `bcryptjs` with a work factor (salt rounds) of 12. Never log unhashed passwords.
2. **JWT Security:** Use strong alphanumeric secrets (minimum 32 characters). Set short expirations (e.g., `7d` for web access).
3. **HTTP Security Headers:** Always initialize `helmet()` at the top of Express.
4. **Rate Limiting:** Protect `/api/auth/login` and `/api/auth/register` with rate limiters (e.g., maximum 10 requests per 15-minute window per IP).
5. **CORS:** Restrict CORS origins explicitly to `CLIENT_URL` (e.g., `http://localhost:5173` in development, specific Vercel URL in production). Never use wildcard `*` in production.
