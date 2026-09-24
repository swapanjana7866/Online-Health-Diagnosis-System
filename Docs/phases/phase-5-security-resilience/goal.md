# Phase 5 Goal: Security Hardening & System Resilience

**Phase ID:** `phase-5-security-resilience`  
**Status:** Ready to Start  
**Prerequisites:** Phase 3 (Diagnosis Backend), Phase 4 (Frontend UI)  

---

## 1. Objective
Harden the entire application stack against common vulnerabilities (OWASP Top 10) and ensure systemic resilience during unexpected traffic surges, network failures, or microservice outages.

---

## 2. Scope & Deliverables

### In Scope
- **HTTP Security Headers:**
  - Configure `helmet` on the Express gateway with hardened `Content-Security-Policy`, `X-Content-Type-Options`, and `Strict-Transport-Security`.
- **CORS Whitelisting:**
  - Replace wildcard CORS with strict origin validation tied to `process.env.CLIENT_URL`.
- **Rate Limiting Middleware:**
  - Implement `express-rate-limit`:
    - Auth routes: Max 10 requests per 15-minute window per IP.
    - Diagnosis inference: Max 30 requests per 15-minute window per user.
    - Global API: Max 200 requests per 15-minute window.
- **Input Sanitization & Injection Defense:**
  - Sanitize request parameters to strip MongoDB operators (`$gt`, `$where`, etc.).
  - Sanitize string inputs to eliminate XSS payload execution.
- **Microservice Fault Tolerance & Circuit-Breaker:**
  - Configure connection timeouts and retries on internal HTTP requests to the ML microservice.
  - Implement a graceful fallback engine that provides supportive guidance if the ML service is down or unresponsive.
- **Graceful Process Shutdown:**
  - Intercept `SIGINT` and `SIGTERM` in `server.js` to finish active HTTP transactions and close Mongoose connections cleanly before exit.

### Out of Scope
- Dedicated hardware Web Application Firewall (WAF) setup (handled via cloud providers during deployment).

---

## 3. Technical Implementation Details

### 3.1 Rate Limiting Configuration (`backend/middleware/rateLimiter.js`)
```javascript
import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
    data: null,
    error: { code: 'RATE_LIMIT_EXCEEDED' }
  },
  standardHeaders: true,
  legacyHeaders: false
});
```

### 3.2 Resilience Fallback Pattern
```javascript
// backend/services/mlService.js
export const getPredictionWithFallback = async (symptoms) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${process.env.ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symptoms }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error(`ML Service responded with status ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('ML Service unreachable or timed out. Engaging fallback heuristic engine:', error.message);
    return getHeuristicFallback(symptoms);
  }
};
```

---

## 4. Definition of Done (DoD) Checklist
- [ ] Helmet middleware successfully sets security headers on all responses (verified via curl / postman).
- [ ] Attempting 11 rapid login attempts triggers HTTP 429 Too Many Requests.
- [ ] CORS rejects unauthorized origins with appropriate error status.
- [ ] Simulating an aborted or crashed ML microservice returns a 201 diagnosis with fallback guidance rather than an uncaught 500 error.
- [ ] Process exits cleanly on `SIGTERM` without dropping active database connections.

---

## 5. Interview / Resume Talking Points
> *"In Phase 5, I elevated this from a typical student tutorial project to an industry-grade secure application. I applied defense-in-depth principles: rate-limiting brute force attacks on authentication routes, configuring Helmet security headers, sanitizing against NoSQL injection, and engineering an automated fallback circuit-breaker that protects user experience during microservice degradation."*
