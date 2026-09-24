# MedInsight Engineering Rules & Coding Standards

This rule file is automatically loaded by Antigravity IDE for the Online Health Diagnosis System workspace. Every code generation, modification, refactor, and architectural decision MUST strictly adhere to these guidelines.

## 1. Non-Negotiable Core Rules
1. **Never Commit Secrets:** `.env` files must NEVER be committed or logged. Use `.env.example` templates with placeholders.
2. **Never Trust Frontend Input:** Always re-validate and sanitize input on the server side using schema validators (`express-validator` on Node, `pydantic` on FastAPI).
3. **Exhaustive Async Handling:** Every async operation must be wrapped in `try/catch` or forwarded to `next(error)`. Zero unhandled promise rejections.
4. **Standardized API Response Shape:**
   All API endpoints must return the uniform envelope:
   ```json
   {
     "success": true | false,
     "message": "Human-readable status message",
     "data": null | object | array,
     "error": null | object
   }
   ```
5. **No Magic Numbers or Strings:** Put all constants (pagination limits, salt rounds, token expirations, fallback strings) in configuration files (`config/constants.js` or `config.py`).
6. **UI State Triad:** All UI components fetching data must handle Loading, Error, and Empty states with visual feedback.
7. **Mandatory Medical Disclaimer:** A visible, prominent disclaimer must be included with every diagnosis result and check-in interface:
   > *"This is an AI-assisted supportive triage tool, not a medical diagnosis. Please consult a certified doctor."*
8. **Microservice Separation of Concerns:**
   - React frontend talks ONLY to the Node.js API Gateway.
   - Node.js API Gateway acts as the secure reverse proxy / client to the Python ML Microservice.
   - The Python ML service is strictly internal and never exposed unauthenticated to the public web.
9. **Resilient ML Integration:** If the Python ML microservice times out (> 3000ms) or is unreachable, the Node API Gateway MUST trigger a graceful fallback (heuristic triage advice) rather than returning a 500 crash to the user.
10. **Zero Console Errors:** Code must produce zero runtime warnings or unhandled exceptions in browser or server logs.

## 2. Coding Practices Reference
- Full architecture: `Docs/ARCHITECTURE.md`
- Detailed coding standards: `Docs/CODING_STANDARDS.md`
- Core rules: `Docs/RULES.md`
- Project requirements: `Docs/PRD.md`
- Milestone roadmap: `Docs/GOALS.md`
