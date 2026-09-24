# Phase 9 Goal: Post-MVP Stretch Goals & Advanced Enhancements

**Phase ID:** `phase-9-stretch-goals`  
**Status:** Planned / Post-MVP  
**Prerequisites:** Phase 8 (Production Deployment & Verification)  

---

## 1. Objective
Expand MedInsight beyond the core MVP into an advanced healthcare triage portal with specialized capabilities including doctor appointment scheduling, printable PDF medical reports, administrative analytics, and containerization.

---

## 2. Stretch Modules & Detailed Specifications

### 2.1 Printable PDF Medical Triage Report
- **Description:** Allow patients to export a diagnosis record as a clean, professionally formatted PDF document to share with their healthcare provider.
- **Tech Stack:** `pdfkit` / `puppeteer` on Node.js or `@react-pdf/renderer` in React.
- **Report Contents:**
  - Patient demographics (anonymized/name, age, gender).
  - Selected symptoms checklist with duration and notes.
  - Primary predicted condition and differential top-3 possibilities.
  - Prominent Medical Disclaimer stamp and QR code linking back to the record.

### 2.2 Doctor Appointment Booking Module
- **Description:** Connect patients with relevant medical specialists based on their predicted condition.
- **Features:**
  - Doctor profiles: Specialization (General Physician, Pulmonologist, Cardiologist, Dermatologist), availability slots, consultation fees.
  - Automatic specialty matching: Common Cold -> General Physician; Chest tightness -> Cardiologist.
  - Booking confirmation workflow with appointment status (Pending, Confirmed, Completed).

### 2.3 Conversational Chatbot Symptom Triage (Conversational UI)
- **Description:** Alternative to the multi-select form where an interactive AI assistant asks conversational follow-up questions to collect symptoms dynamically before triggering the ML inference engine.

### 2.4 Administrative Analytics Dashboard
- **Description:** Role-based access (`role: "admin"`) view providing healthcare analytics.
- **Metrics:**
  - Total registered patients and total check-ins.
  - Most frequently reported symptoms (bar chart).
  - Most prevalent predicted conditions (pie chart).
  - System performance (average ML response latency).

### 2.5 Multi-Container Docker Compose (`docker-compose.yml`)
- **Description:** Orchestrate the entire multi-service application with a single command (`docker-compose up --build`).
- **Services:**
  - `frontend`: Nginx serving static Vite production build.
  - `backend`: Node.js API Gateway container.
  - `ml-service`: Python FastAPI container with installed dependencies and serialized model.
  - `mongo`: Local MongoDB container for offline testing.

---

## 3. Definition of Done (DoD) Checklist
- [ ] Core MVP remains 100% operational and unaffected by new stretch features.
- [ ] Each stretch feature is developed on a dedicated `feature/` branch with tests.
- [ ] PDF generation produces a clean, readable layout formatted for standard A4 paper.
- [ ] Docker Compose launches all 3 tiers with a single terminal command.

---

## 4. Interview / Resume Talking Points
> *"In Phase 9, I explored advanced enterprise capabilities. Adding PDF generation provided real utility for patients seeking doctor consultations, while building a Docker Compose setup demonstrated container orchestration skills that bridge the gap between software development and DevOps."*
