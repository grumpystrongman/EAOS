---
title: Persona-Focused Information Architecture
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-04-03T17:25:29.049Z'
updatedAt: '2026-04-03T17:25:29.049Z'
---
## Raw Concept
**Task:**
Implement persona-focused information architecture and navigation for admin-console

**Changes:**
- Added workspace mode filtering (evaluator/operator/governance/all)
- Introduced always-visible guide panel and /guides page
- Created operations-vs-governance decision register and role-based route access
- Linked setup to role guides
- Persona switching and session management in UI

**Files:**
- frontend/apps/admin-console/src/app/App.tsx
- frontend/apps/admin-console/src/app/pages/guides-page.tsx
- frontend/apps/admin-console/src/app/routes.ts
- frontend/apps/admin-console/src/styles.css

**Flow:**
User launches admin-console -> selects workspace mode -> navigates via sectioned routes -> uses guides and panels for onboarding and operations -> access and permissions enforced by role and mode

**Timestamp:** 2026-04-03

## Narrative
### Structure
Admin-console UI is organized by persona (evaluator, operator, governance) and workspace mode. Navigation is grouped by foundation, operate, and govern. Sidebar and panels provide always-visible guidance, persona switching, and live session management. Route access is enforced by user roles and selected workspace mode.

### Dependencies
Requires user role management, session context, and workspace mode state.

### Highlights
Fast onboarding for evaluators, daily operations runbook for operators, governance workflows for security and audit. Operations-vs-governance escalation register and all UI flows covered by TypeScript and pipeline checks.

### Rules
Route access logic: no role = always visible; "all" match = user must have all roles; "any" match = user must have one of the roles. Escalation rules for connector allowlists, policy tuning, role grants, workflow promotion.

### Examples
Evaluator steps: connect evaluator identities, run simulation, review commercial scenario, verify connectors, confirm evidence. Operator steps: verify integrations, validate workflow, run simulation/live, process approvals, review incidents/audit.

## Facts
- **admin-console**: Workspace mode filtering was added to the admin-console persona-focused IA refactor, supporting evaluator, operator, governance, and all modes.
- **admin-console**: A guide panel is now always visible in the admin-console.
- **admin-console**: A new /guides page was added with evaluator and operator workflows and an operations-vs-governance decision register.
- **admin-console**: Setup now links to role guides in the admin-console.
- **admin-console**: Supported roles in the admin-console are platform_admin, security_admin, auditor, workflow_operator, approver, and analyst.
- **admin-console**: Workspace modes include all, evaluator, operator, and governance, each showing different routes and workflows.
- **admin-console**: Routes for evaluator mode include /setup, /guides, /dashboard, /commercial, /projects, /project-guide, /sandbox-proof, and /audit.
- **admin-console**: Routes for operator mode include /setup, /guides, /integrations, /agents, /workflows, /simulation, /approvals, /incidents, and /audit.
- **admin-console**: Routes for governance mode include /setup, /guides, /identity, /admin, /security, /approvals, /incidents, /audit, and /commercial.
- **admin-console**: The sidebar panel in the admin-console shows pilot use case details, workspace mode summary, always-visible guides, and connected personas.
- **admin-console**: Users can switch between 'clinician' and 'security' personas and connect or reconnect demo users in the admin-console.
- **admin-console**: Navigation routes are grouped by section: foundation, operate, and govern.
- **admin-console**: Route access is controlled by user roles and workspace mode.
- **admin-console**: The topbar in the main content shows the current route, persona, mode, route type, last sync time, and allows jumping to setup.
- **admin-console**: Banners indicate sync errors, refreshing, or when a route is outside the selected mode.
- **admin-console**: PageHeader displays onboarding or workflow context and badges for workflowId, patientId, tenantId, and evidence.
- **admin-console**: If route access is denied, users are prompted to switch persona or reconnect sessions.
- **admin-console**: The operations vs governance decision register defines escalation criteria for connector destination allowlist changes, policy profile baseline tuning, role grants and assurance upgrades, and live workflow promotion.
- **admin-console**: The AppRoute interface defines properties for path, title, summary, accent, section, requiredRoles, match, and requireStepUpMfa.
- **admin-console**: Route definitions specify which roles are required for each route and whether step-up MFA is needed.
- **admin-console**: The canAccessRoute function determines route access based on session roles and route requirements.
