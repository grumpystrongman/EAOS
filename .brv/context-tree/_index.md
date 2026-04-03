---
children_hash: 59a70d6dc28688f05fb249a245dd1e796215e28c598b5afbb3e837334735944d
compression_ratio: 0.5926421404682274
condensation_order: 3
covers: [architecture/_index.md]
covers_token_total: 1495
summary_level: d3
token_count: 886
type: summary
---
# Architecture Domain Structural Summary (Level d3)

The architecture domain encapsulates the foundational design, operational enforcement, and security patterns for the OpenAegis platform and its environments. It is organized into distinct topic areas, each preserving critical architectural facts, entity relationships, and compliance mechanisms.

---

## Admin Console

- Persona-driven UI with evaluator, operator, and governance modes (see: admin_console/persona_focused_information_architecture.md).
- Role-based access and escalation logic, including step-up MFA for sensitive actions.
- Context-aware navigation and session management; onboarding always accessible.
- Core logic in TypeScript (`App.tsx`, `routes.ts`), fully type-checked and pipeline-validated.

---

## OpenAegis Overview

- Layered architecture: Experience, Control, Secure Agent Runtime, Data, Trust planes (see: openaegis_overview/openaegis_architecture_blueprint.md).
- Zero-trust enforcement, dual-approval for privileged actions, default-deny egress.
- Dependencies: PostgreSQL, Kafka/NATS, Redis, Minio.

---

## OpenAegis Pilot

- Automates clinical workflows with policy-gated inference and audit logging (see: openaegis_pilot/openaegis_pilot_overview.md).
- Enforces `REQUIRE_APPROVAL` for high-risk workflows; token-based authentication mandatory.
- Key components: API gateway, admin console, automation scripts, runbooks.

---

## OpenAegis Security and Governance

- OIDC/SAML identity integration, microVM/container isolation, mandatory TLS 1.3.
- Immutable evidence logs; 6+ year ePHI retention.
- PHI/ePHI exposure is a system failure; high-risk actions require explicit policy/approval (see: openaegis_security/openaegis_security_and_governance.md).

---

## OpenClaw Security Audit

- Security hardening, dependency/secret scans, regression testing (see: openclaw_security_audit/context.md, openclaw_security_audit_and_regression.md).
- Only approved install-script packages; all audits/regressions must pass.
- No secrets in source/config; environment variables follow OpenAegis conventions.
- All audits/regressions passed; 0 vulnerabilities/warnings.
- Explicit package, audit, and environment rules preserved verbatim.

---

## Pipeline

- Automated flow: commit → typecheck → build → security regression → dependency/secret scan → smoke test → sandbox proof → oversight review → deploy (see: pipeline/context.md, pipeline_and_security_verification.md).
- Deployment blocked on any failed check or missing audit evidence.
- 14 regression checks (token introspection, tenant scope, approval roles, etc.) must all pass.
- Oversight review and sandbox proofs are mandatory; results documented.

---

## Sandbox SecOps

- Docker Compose services and environment variable management (see: sandbox_secops/sandbox_secops_configuration.md, redpanda_port_configuration_and_service_probes.md).
- All service ports parameterized to avoid conflicts; probe URLs aligned and validated.
- Full sandbox rerun includes startup, seeding, provisioning, smoke tests—must all succeed.
- OpenClaw CLI and Manus MCP integrated with local token authentication.
- Strict enforcement of port, probe, and configuration rules.

---

## Cross-Cutting Patterns

- Uniform enforcement of security, audit, and compliance across all domains.
- Centralized configuration management and validation.
- Immutable logs, audit pipelines, and oversight reviews ensure operational assurance.
- For detailed rules, flows, and procedures, refer to the specific child entries listed above.