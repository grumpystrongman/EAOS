# EAOS

EAOS is an open-source enterprise agent orchestration and trust platform for regulated environments, with healthcare-grade controls as a first-class requirement.

## What is in this repository

- Architecture and security blueprint: `docs/eaos-blueprint.md`
- Typed backend service skeletons: `backend/services/*`
- Shared contracts and event envelopes: `backend/shared/contracts`, `backend/shared/events`
- Baseline policy bundles: `backend/shared/policies/rego`, `backend/shared/policies/cedar`
- Python runtime starter (simulation-first): `backend/runtime/python-agent-runner`
- React admin console shell: `frontend/apps/admin-console`
- Kubernetes and Helm security baseline: `infrastructure/`

## Core principles

- Default deny on network egress and sensitive data movement
- Policy and approvals enforced outside the model
- Immutable evidence for major actions
- Vendor-neutral model and connector abstraction
- Multi-tenant isolation by design

## Quickstart (local)

1. `docker compose up -d postgres zookeeper kafka redis minio`
2. `npm install`
3. `npm run typecheck`
4. `npm run test`

## MVP priority

1. Secure control plane
2. Model broker
3. Policy engine
4. Agent runtime
5. Approval workflow
6. Audit trail
7. SQL and FHIR connectors
8. Admin console, simulation lab, KPI dashboard