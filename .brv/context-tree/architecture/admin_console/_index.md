---
children_hash: cff23373f34429b4fe6ec60bc10af04e3ddf6f994c13d32483f97baf9e5217f4
compression_ratio: 0.6323099415204678
condensation_order: 1
covers: [context.md, persona_focused_information_architecture.md]
covers_token_total: 1368
summary_level: d1
token_count: 865
type: summary
---
# Admin Console Structural Summary

The **admin_console** domain documents the UI architecture and navigation logic for the admin-console, emphasizing persona-driven design, workspace modes, and robust role-based access control. Key architectural decisions and relationships are as follows:

## Persona-Focused Information Architecture
- **Personas & Workspace Modes:** UI is organized by persona (evaluator, operator, governance) and workspace mode, each exposing tailored navigation routes and workflows.
    - **Evaluator Mode:** Routes include /setup, /guides, /dashboard, /commercial, /projects, /project-guide, /sandbox-proof, /audit.
    - **Operator Mode:** Routes include /setup, /guides, /integrations, /agents, /workflows, /simulation, /approvals, /incidents, /audit.
    - **Governance Mode:** Routes include /setup, /guides, /identity, /admin, /security, /approvals, /incidents, /audit, /commercial.
- **Role-Based Route Enforcement:** Access to routes is determined by user roles (platform_admin, security_admin, auditor, workflow_operator, approver, analyst) and workspace mode. The `canAccessRoute` function and `AppRoute` interface enforce these constraints, including step-up MFA where required.
- **Navigation Structure:** Navigation is grouped by section (foundation, operate, govern). Sidebar panels provide always-visible guides, workspace summaries, and persona/session management. The topbar displays current context, route, persona, mode, and sync status.
- **Session & Persona Management:** Users can switch between personas (e.g., 'clinician', 'security'), connect/reconnect demo users, and manage sessions directly from the UI.
- **Guidance & Onboarding:** Always-visible guide panels and a dedicated /guides page support onboarding and workflow execution. Page headers display context and badges (workflowId, patientId, tenantId, evidence).
- **Escalation & Decision Register:** The operations-vs-governance decision register defines escalation logic for connector allowlists, policy tuning, role grants, and workflow promotion.
- **Error & Access Handling:** Banners indicate sync errors or access issues; denied access prompts persona switching or session reconnection.

## Key Relationships and Dependencies
- **Dependencies:** Relies on user role management, session context, and workspace mode state.
- **Related Topics:** Closely linked to broader architectural blueprints and pilot overviews (see: `openaegis_architecture_blueprint`, `openaegis_pilot_overview`).

## Implementation Details
- **Files:** Core implementation in `frontend/apps/admin-console/src/app/App.tsx`, `pages/guides-page.tsx`, `routes.ts`, and `styles.css`.
- **TypeScript & Pipeline Checks:** All UI flows are type-checked and validated through the pipeline.

## Summary Table of Key Facts
- Persona-driven navigation and workspace filtering are central to the admin-console's IA.
- Always-visible guides and a /guides page enhance onboarding and operational efficiency.
- Route access is strictly enforced by role and workspace mode, with escalation logic for sensitive actions.
- UI supports dynamic persona switching, session management, and context-aware navigation.
- All architectural decisions and access logic are codified in TypeScript interfaces and functions.

For detailed implementation and logic, refer to `persona_focused_information_architecture.md`. For broader context and relationships, see related topics in the architecture domain.