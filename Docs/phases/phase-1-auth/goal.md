# Phase 1 Goal: Secure Authentication & User Profile Management

**Phase ID:** `phase-1-auth`  
**Status:** Completed  
**Prerequisites:** Phase 0 (Baseline Setup & Monorepo Architecture)  

---

## 1. Objective
Build an end-to-end, production-grade JWT authentication and profile management module across the Node.js API Gateway and React frontend, enforcing server-side input validation, password hashing with bcrypt, protected route guards, and seamless session persistence.

---

## 2. Scope & Deliverables

### In Scope
- **Backend (Node/Express):**
  - Mongoose `User` model with unique lowercase email and timestamps.
  - Password hashing via `bcryptjs` with salt rounds $\ge 12$.
  - Endpoints:
    - `POST /api/auth/register` (Validation: min 8 char password with at least one digit).
    - `POST /api/auth/login` (Returns signed JWT access token + user summary).
    - `GET /api/users/me` (Protected: returns profile of authenticated user).
    - `PUT /api/users/me` (Protected: allows updating name, age, gender).
  - JWT middleware (`authMiddleware.js`) verifying bearer token and attaching `req.user`.
  - Rate limiting on auth routes to prevent brute-force attacks.
- **Frontend (React):**
  - `AuthContext.jsx` managing user state, token in localStorage, login, register, and logout.
  - Form validation with inline feedback on `Login.jsx` and `Signup.jsx`.
  - `ProtectedRoute.jsx` guarding private routes (`/dashboard`, `/history`, `/profile`).
  - Axios interceptors in `src/services/api.js` attaching JWT and handling 401 session expiration.

### Out of Scope
- Diagnosis history and symptom submission (deferred to Phase 3 & 4).
- Password reset via email / OTP (future enhancement).

---

## 3. Technical Specification & API Contract

### 3.1 Endpoint Specifications

#### 1. Register User
- **Method:** `POST /api/auth/register`
- **Request Body:**
  ```json
  {
    "name": "Alex Smith",
    "email": "alex@example.com",
    "password": "SecurePassword123"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "token": "eyJhbGciOiJIUzI1Ni...",
      "user": {
        "id": "64b8f...",
        "name": "Alex Smith",
        "email": "alex@example.com"
      }
    },
    "error": null
  }
  ```

#### 2. Login User
- **Method:** `POST /api/auth/login`
- **Request Body:**
  ```json
  {
    "email": "alex@example.com",
    "password": "SecurePassword123"
  }
  ```
- **Response (200 OK):** Same payload shape as registration.

#### 3. Get / Update Profile
- **Method:** `GET /api/users/me` & `PUT /api/users/me`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "User profile fetched successfully",
    "data": {
      "user": {
        "id": "64b8f...",
        "name": "Alex Smith",
        "email": "alex@example.com",
        "age": 29,
        "gender": "male",
        "createdAt": "2026-09-11T12:00:00.000Z"
      }
    },
    "error": null
  }
  ```

---

## 4. Definition of Done (DoD) Checklist
- [x] User cannot register with an existing email (returns 409 Conflict with human-readable error message).
- [x] Passwords hashed with bcryptjs salt rounds $\ge 12$; never saved or logged in plaintext.
- [x] Password validation requires $\ge 8$ characters and $\ge 1$ digit on both frontend and backend.
- [x] Protected endpoints reject unauthenticated or expired tokens with HTTP 401.
- [x] Token is saved in client storage and restored on page refresh without requiring re-login.
- [x] Logging out clears the client-side session and redirects to `/login`.
- [x] Brute-force rate limiter restricts repeated failed attempts on `/api/auth/login`.

---

## 5. Interview / Resume Talking Points
> *"In Phase 1, I engineered a zero-trust authentication architecture. Instead of relying solely on client-side validation, I applied strict schema validation on Express, salted password hashing with bcrypt, and stateless JWT tokens verified through custom middleware. I also implemented Axios interceptors to seamlessly handle token injection and automated 401 unauthorized session expiration."*
