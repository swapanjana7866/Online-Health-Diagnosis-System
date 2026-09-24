# Phase 4 Goal: Polished Frontend Diagnosis Experience

**Phase ID:** `phase-4-frontend-ui`  
**Status:** Ready to Start  
**Prerequisites:** Phase 1 (Auth), Phase 3 (Diagnosis Backend)  

---

## 1. Objective
Build a rich, responsive, and accessible user interface for the symptom check-in and diagnosis lifecycle. The UI must delight users with modern aesthetic polish, intuitive searchable symptom multi-selection, real-time confidence visualization, prominent medical safety disclaimers, and an interactive diagnosis history viewer.

---

## 2. Scope & Deliverables

### In Scope
- **Symptom Selector Component (`SymptomSelector.jsx`):**
  - Searchable multi-select input with live filtering across 130+ symptoms.
  - Selected symptom tags (chips) with one-click removal and "Clear All".
  - Quick-select common symptoms (e.g., headache, fever, cough, fatigue).
  - Validation ensuring at least one symptom is selected before submission.
- **Diagnosis Result View (`ResultCard.jsx` / `DiagnosisResult.jsx`):**
  - Hero card displaying the primary predicted condition with confidence score.
  - Interactive confidence gauge or visual progress bars for top-3 differential predictions.
  - Severity badge (Low / Moderate / Needs Medical Attention).
  - Prominent, non-dismissible **Medical Disclaimer Banner**.
- **Diagnosis History Page (`History.jsx`):**
  - Chronological card list or clean data table sorted newest first.
  - Pagination controls (Previous, Next, Page numbers).
  - Detail drawer/modal showing all recorded symptoms, prediction timestamp, and confidence breakdown.
  - Delete diagnosis confirmation dialog.
- **Profile & Navigation (`Navbar.jsx`, `Profile.jsx`):**
  - Clean responsive navigation bar with active route highlighting, user greeting, and logout.
  - Profile edit form allowing updates to name, age, and gender with real-time feedback.
- **UI State Triad Everywhere:**
  - Skeleton screens during data loading.
  - Human-readable error banners with retry buttons.
  - Engaging empty state illustrations when no history records exist.

### Out of Scope
- Conversational / Chatbot symptom input (deferred to Phase 9).
- PDF download button (deferred to Phase 9).

---

## 3. Design & Usability Requirements

1. **Visual Hierarchy & Color Palette:**
   - Healthcare-inspired modern aesthetic: Deep slate, calming teal/cyan primary accents, amber for warnings, and rose for emergency triage alerts.
   - Clean card-based layout with soft shadows and subtle borders.
2. **Accessibility Standards (WCAG 2.1 AA):**
   - High color contrast for text readability.
   - Keyboard navigable dropdowns and tags (focus outlines, `Enter` to select, `Backspace` to delete chip).
   - Form inputs with explicit `aria-label` or `<label>` associations.
3. **Responsive Breakpoints:**
   - Smooth layout transitions from mobile single-column (`< 640px`) to desktop dashboard (`>= 1024px`).

---

## 4. Definition of Done (DoD) Checklist
- [ ] User can search, add, and remove symptoms effortlessly using both mouse and keyboard.
- [ ] Submitting symptoms triggers a loading indicator and renders prediction results.
- [ ] Top-3 predictions and confidence percentages are clearly visible and formatted.
- [ ] Medical disclaimer is prominently displayed on the result view and cannot be hidden.
- [ ] Past diagnoses load with pagination and can be inspected in a modal/drawer.
- [ ] Zero unhandled errors or console warnings in browser developer tools.
- [ ] Tested and verified on mobile screen widths (375px) and desktop (1280px).

---

## 5. Interview / Resume Talking Points
> *"In Phase 4, I focused on user-centered medical UX and accessibility. Rather than presenting a generic dropdown or unstructured text field, I built a searchable multi-select tag input handling 130+ symptoms with keyboard navigation. I also integrated visual confidence breakdown bars for top-3 conditions, ensuring that users can understand differential possibilities while always encountering clear medical disclaimer boundaries."*
