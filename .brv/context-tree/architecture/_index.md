---
children_hash: afb1fae665853c082af7b7adbaf2b7d89d654dfe8123b612ae3b9be832b85bea
compression_ratio: 0.31039106145251394
condensation_order: 2
covers: [admin_console/_index.md, openaegis_overview/_index.md, openaegis_pilot/_index.md, openaegis_security/_index.md, openclaw_security_audit/_index.md, pipeline/_index.md, sandbox_secops/_index.md]
covers_token_total: 4475
summary_level: d2
token_count: 1389
type: summary
---
# Architecture Domain Structural Summary (Level d2)

The architecture domain documents the foundational design, operational flows, and security enforcement mechanisms for the OpenAegis platform and its supporting environments. It is organized into several key topic areas, each preserving core architectural decisions, entity relationships, and enforcement patterns.

---

## Admin Console

- **Persona-Driven UI:** The admin console is structured around evaluator, operator, and governance personas, each with dedicated workspace modes and navigation routes (see: admin_console/persona_focused_information_architecture.md).
- **Role-Based Access:** Route access is enforced via user roles and workspace mode, with escalation logic for sensitive actions and step-up MFA where required.
- **Navigation & Session Management:** Sidebar and topbar provide context-aware navigation, persona switching, and session controls. Guides and onboarding are always accessible.
- **Implementation:** Core logic resides in TypeScript files such as `App.tsx`, `routes.ts`, with all flows type-checked and pipeline-validated.
- **Key Relationships:** Tied to architectural blueprints and pilot overviews for broader context.

---

## OpenAegis Overview

- **Layered Architecture:** The platform is divided into Experience, Control, Secure Agent Runtime, Data, and Trust planes (see: openaegis_overview/openaegis_architecture_blueprint.md).
- **Zero-Trust & Compliance:** Enforces zero-retention for sensitive data, dual-approval for privileged actions, and default-deny egress.
- **Dependencies:** Relies on PostgreSQL, Kafka/NATS, Redis, and Minio for core operations.

---

## OpenAegis Pilot

- **Workflow Automation:** Automates clinical workflows with policy-gated inference and audit logging (see: openaegis_pilot/openaegis_pilot_overview.md).
- **Critical Constraints:** Enforces `REQUIRE_APPROVAL` for high-risk workflows and mandates token-based authentication.
- **Key Components:** Includes API gateway, admin console interface, automation scripts, and operational runbooks.

---

## OpenAegis Security and Governance

- **Access & Isolation:** Integrates OIDC/SAML for identity, multi-tenant microVM/container isolation, and mandatory TLS 1.3.
- **Audit & Retention:** Maintains immutable evidence logs and enforces a 6+ year retention policy for ePHI.
- **Governance:** PHI/ePHI exposure is a system failure; all high-risk actions require explicit policy/approval (see: openaegis_security/openaegis_security_and_governance.md).

---

## OpenClaw Security Audit

- **Audit Pipeline:** Documents security hardening, dependency/secret scans, and regression testing for OpenAegis deployments (see: openclaw_security_audit/context.md, openclaw_security_audit_and_regression.md).
- **Strict Enforcement:** Only approved install-script packages allowed; all audits and regression checks must pass (exit code 0).
- **No Secrets Policy:** Source/config files must be secret-free; environment variables must follow OpenAegis conventions.
- **Results:** All audits and regression suites passed; 0 vulnerabilities or warnings.
- **Rules & Patterns:** Explicit package, audit, and environment rules are preserved verbatim for enforcement and reference.

---

## Pipeline

- **Automated Gates:** Enforces a strict flow: commit → typecheck → build → security regression → dependency/secret scan → smoke test → sandbox proof → oversight review → deploy (see: pipeline/context.md, pipeline_and_security_verification.md).
- **Blocking Criteria:** Deployment is blocked on any failed check, vulnerability, or missing audit evidence.
- **Security Regression:** 14 regression checks (token introspection, tenant scope, approval roles, break-glass, revoked tokens) must all pass.
- **Oversight & Artifacts:** Oversight review and sandbox proofs are mandatory, with all results documented (e.g., oversight-review-report.json).

---

## Sandbox SecOps

- **Environment Configuration:** Documents Docker Compose services (Redpanda, Prometheus, Grafana, OPA) and environment variable management for the SecOps sandbox (see: sandbox_secops/sandbox_secops_configuration.md, redpanda_port_configuration_and_service_probes.md).
- **Port Parameterization:** All service ports are parameterized via environment variables to avoid conflicts.
- **Health Probes:** Probe URLs are aligned with port assignments and validated via `sandbox.json`.
- **Operational Validation:** Full sandbox rerun includes startup, seeding, provisioning, and smoke tests; all steps must succeed.
- **Integration:** OpenClaw CLI and Manus MCP are integrated with local token authentication.
- **Rules:** Non-conflicting ports, probe alignment, and configuration validation are strictly enforced.

---

## Cross-Cutting Patterns and Relationships

- **Security and Compliance:** All domains enforce strict security, audit, and compliance requirements, with zero-tolerance for vulnerabilities or misconfigurations.
- **Configuration Management:** Environment variables and configuration files are centrally documented and validated.
- **Auditability:** Immutable logs, audit pipelines, and oversight reviews are core to operational assurance.
- **Drill-Down:** For implementation details, rules, and procedural specifics, reference the respective child entries listed above.

---

This summary provides a compressed structural map of the architecture domain, highlighting key facts, architectural decisions, and relationships. For detailed procedures, rules, and technical flows, consult the referenced child entries.