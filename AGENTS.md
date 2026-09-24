# Carepath / MedInsight — AI Agent Instructions & Workspace Rules

Welcome to the MedInsight (Online Health Diagnosis System) workspace.

## Agent Behavior Mandates
1. **Single Source of Truth:** Refer to [Docs/PRD.md](file:///e:/Online-Health-Diagnosis-System/Docs/PRD.md) and [Docs/ARCHITECTURE.md](file:///e:/Online-Health-Diagnosis-System/Docs/ARCHITECTURE.md) before making architectural choices.
2. **Mandatory Rules & Code Standards:** Strictly follow [Docs/RULES.md](file:///e:/Online-Health-Diagnosis-System/Docs/RULES.md) and [Docs/CODING_STANDARDS.md](file:///e:/Online-Health-Diagnosis-System/Docs/CODING_STANDARDS.md).
3. **Phased Development:** When working on milestones, follow the exact specifications and checklists defined in [Docs/GOALS.md](file:///e:/Online-Health-Diagnosis-System/Docs/GOALS.md) and the corresponding `Docs/phases/phase-X-*/goal.md` files.
4. **Unified API Envelope:** Never send raw unformatted JSON from controllers. Always use `{ success, message, data, error }`.
5. **Medical Safety:** Always ensure the medical disclaimer is preserved in all health-related UI components and API responses.
