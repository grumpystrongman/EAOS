# MVP Plan

## MVP Definition (Commercial Baseline)

OpenAegis MVP is considered commercially pilot-ready when all of the following are true:

- secure control plane services are implemented and tested
- policy + approval + audit controls are enforced on live flows
- model routing and tool execution are policy-governed
- simulation and live pilot flows both pass
- deployment artifacts (Docker, Kubernetes, Helm) are complete and validated
- readiness gate score is >= 98

## In-Scope Services (MVP)

- API Gateway
- Auth Service
- Tenant Service
- Policy Service
- Workflow Orchestrator
- Agent Registry
- Tool Registry
- Tool Execution Service
- Model Broker
- Context Retrieval Service
- Classification Service
- Approval Service
- Audit Ledger
- Notification Service
- Secrets Broker
- Observability Service
- Kill Switch Service

## Mandatory MVP Commands

```bash
npm run typecheck
npm run build
npm run test
npm run validate:infra
npm run smoke:pilot
npm run proof:commercial
npm run load:commercial
npm run chaos:commercial
npm run backup:state
npm run restore:state -- latest
npm run evidence:package
npm run readiness:gate
```

Pass criteria:

- every command exits 0
- `docs/assets/demo/readiness-gate-report.json` has `summary.status = PASS`
- `docs/assets/demo/readiness-gate-report.json` has `summary.scorePercent >= 98`

## Deployment Packaging (MVP)

MVP deployment artifacts now include:

- service Dockerfiles for every backend service
- Kubernetes base manifests for all MVP services in `infrastructure/kubernetes/base`
- Helm chart in `infrastructure/helm/openaegis`
- infra validation script: `tools/scripts/validate-infra.mjs`

## Deferred (Post-MVP)

- external IdP production federation setup per customer
- managed cloud KMS/HSM rollout per environment
- service mesh rollout and cert automation at enterprise scale
- external pentest / red-team engagement package
- multi-region active-active failover

## Commercial Hardening Notes

Current MVP prioritizes executable safety controls and evidence generation over feature breadth.
For enterprise sales, this is the right order: prove control correctness first, then expand connectors and scaling tiers.
