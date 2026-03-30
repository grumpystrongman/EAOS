# OpenAegis Threat Model

This document defines the operational threat model for OpenAegis in regulated enterprise deployment contexts.

## Security Objective

Prevent unauthorized data exposure and unauthorized action execution, while preserving full forensic traceability for every high-risk workflow.

## Scope

In scope:

- control plane APIs
- policy and approval paths
- tool registry and execution boundary
- model routing and provider policies
- secrets brokering and lease lifecycle
- evidence/audit integrity
- kill-switch containment path

Out of scope:

- vendor infrastructure internals beyond contractual controls
- enterprise network controls outside OpenAegis deployment boundary

## Assets to Protect

- PHI/ePHI and PII payloads
- credentials and secret material
- policy bundles and profile changes
- approval decisions
- audit/evidence chain integrity
- tenant isolation boundaries

## Trust Boundaries

1. User/UI to API gateway boundary.
2. Control plane service-to-service boundary.
3. Secure runtime to external connector boundary.
4. Model broker to provider boundary.
5. Evidence boundary (audit ledger/object storage).

## Primary Adversary Goals

1. Exfiltrate sensitive data through model/tool/output paths.
2. Execute high-risk write actions without approval.
3. Cross tenant boundaries.
4. Tamper with evidence trails.
5. Abuse emergency controls (break-glass/kill-switch).

## Key Attack Surfaces

- API endpoints (`/v1/*`) with malformed/missing identity context
- policy profile update endpoints
- tool execution endpoint and connector parameters
- model routing requests for sensitive data classes
- secret lease endpoints and TTL misuse
- audit ingestion and retrieval paths

## Core Control Strategy

### Preventive controls

- fail-closed authz checks with tenant context requirements
- policy evaluation outside model execution path
- explicit approval requirement for high-risk live actions
- tool runtime guards (approval, network profile, budget)
- short-lived secret leases and revocation support
- provider routing constraints including zero-retention policies

### Detective controls

- immutable audit/evidence chain verification
- observability envelopes and incident records
- commercial/trust proof artifacts per release
- codebase line audit for production anti-pattern markers

### Corrective controls

- kill-switch scoped containment trigger/release
- backup/restore drills
- readiness gate reruns after remediation

## High-Risk Scenarios and Expected Outcomes

1. Attempted unapproved high-risk workflow action:
   - expected result: blocked, approval ticket generated, no execution completion
2. Attempted unsafe outbound tool call:
   - expected result: runtime guard rejection
3. Attempted tenant boundary violation:
   - expected result: authorization denial
4. Attempted audit tampering:
   - expected result: chain verification failure detection
5. Emergency containment event:
   - expected result: kill-switch trigger and immutable event chain

## Security Assumptions

- enterprise IdP and role mapping are correctly configured
- TLS and network segmentation are enforced by deployment platform
- KMS/KEK material for non-local providers is provisioned securely
- production secrets are never stored in source control

## Validation and Test Strategy

Required command path:

```bash
npm run typecheck
npm run build
npm run test
npm run validate:test-surface
npm run validate:infra
npm run smoke:pilot
npm run proof:commercial
npm run proof:trust-layer
npm run audit:codebase
npm run audit:commercial
npm run trust:pack
npm run trust:audit
npm run load:commercial
npm run chaos:commercial
npm run readiness:gate
```

All commands must pass for release candidacy.

## Residual Risks

- external pentest and red-team findings are not zero by default
- provider-side controls depend on vendor contract and runtime options
- operational misconfiguration remains possible without disciplined change management

Residual risk is managed through the readiness gate, trust pack audit, and external validation cycles.
