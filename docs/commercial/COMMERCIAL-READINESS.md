# EAOS Commercial Readiness

EAOS is a vendor-neutral enterprise agent platform built for regulated environments. In practical terms, it lets a hospital or health system run AI-assisted workflows without giving the model free rein over data, tools, or outbound actions.

The pilot in this repository centers on a real operating use case: a **Hospital Discharge Readiness Assistant**. It is not a chat demo. It is a controlled workflow that:

- reads approved patient context
- routes model calls based on sensitivity and zero-retention policy
- blocks risky actions until a human approves them
- records evidence for every major decision
- exposes audit and incident trails for review and replay

## What EAOS Does

### For a layperson

EAOS is the control system around an AI agent. It helps the organization answer four questions before anything sensitive happens:

1. What is the agent trying to do?
2. Is it allowed to do it?
3. If it is risky, who approved it?
4. Can we prove what happened later?

That makes the difference between "an AI assistant that can act" and "an AI assistant that can act safely in a hospital."

### For IT and security buyers

EAOS is an orchestration and trust layer with these properties:

- policy is enforced outside the model
- approval is required for high-risk actions
- tool execution runs in a guarded runtime with bounded permissions
- model routing is vendor neutral and sensitivity aware
- audit evidence is immutable, searchable, and replayable
- tenant boundaries are explicit instead of implied

The design goal is not autonomy at all costs. The design goal is controlled automation that survives audit, incident review, and compliance scrutiny.

## Why EAOS Is Different

Most "agent" products optimize for task completion inside the model loop. EAOS optimizes for enterprise control outside the model loop.

That distinction matters because a regulated enterprise cannot delegate the following to a model prompt:

- whether PHI may be sent to a provider
- whether a tool may be called
- whether a live action needs human approval
- whether a connector may write data back
- whether a model provider is allowed to retain data

EAOS treats those as control-plane decisions, not model opinions.

### Control-first differentiators

- **Policy outside the model**: authorization and routing are enforced before execution.
- **Human approval gates**: live and high-risk actions pause until approved.
- **Sandboxed tool runtime**: tool calls are permissioned, bounded, and auditable.
- **Zero-retention routing**: sensitive workloads can be routed only to providers that support the required posture.
- **Evidence chain**: each execution produces traceable artifacts, approval records, and audit events.
- **Vendor neutrality**: provider choice lives behind a broker, not in business logic.

## How We Prove the Claims

EAOS does not ask buyers to trust slides. It ships with executable proof.

The current pilot includes three forms of evidence:

1. **Integration tests** for the API gateway
2. **Commercial proof harness** that executes the live pilot path
3. **Generated proof report** written to `docs/assets/demo/commercial-proof-report.json`

### Core proof commands

```bash
npm run test:commercial
npm run proof:commercial
npm run smoke:pilot
node tools/scripts/pilot-demo.mjs
npm run screenshots:commercial
```

### What those commands verify

- `npm run test:commercial`
  - builds the workspace
  - runs the commercial proof test suite
  - checks that the report schema, score, and claim results are present

- `npm run proof:commercial`
  - boots the gateway, tool registry, and tool execution services
  - runs the discharge assistant flow
  - verifies policy gating, approval handling, deterministic graph stages, audit evidence, signed connector coverage, runtime guards, and idempotent retries
  - writes a machine-readable evidence report

- `npm run smoke:pilot`
  - validates the pilot path end to end
  - confirms the control plane is still able to run the live demo path

### Current claim set

The generated commercial proof report includes claims for:

- policy gates enforced outside the model
- human approval for high-risk live workflows
- audit and evidence coverage
- EPHI zero-retention routing
- deterministic graph checkpoints
- signed connector registry coverage
- tool runtime guard enforcement
- idempotent retry protection

The report is not a narrative artifact. It is a summary of executable checks.

## Current Pilot Evidence

The live pilot already demonstrates the control surfaces buyers care about:

- **Admin Console**: tenant and pilot workspace controls
- **Security Console**: policy preview and routing posture
- **Workflow Designer**: step-by-step discharge flow
- **Approval Inbox**: pending and completed human decisions
- **Incident Review Explorer**: derived incidents from blocked or rejected actions
- **Audit Explorer**: evidence-linked event history
- **Simulation Lab**: safe execution before live use
- **Commercial Readiness**: claim-to-evidence scorecard

Supporting artifacts live in the repository:

- `docs/assets/screenshots/commercial-dashboard.png`
- `docs/assets/screenshots/commercial-readiness.png`
- `docs/assets/screenshots/commercial-admin.png`
- `docs/assets/screenshots/commercial-security.png`
- `docs/assets/screenshots/commercial-workflow.png`
- `docs/assets/screenshots/commercial-approvals.png`
- `docs/assets/screenshots/commercial-incidents.png`
- `docs/assets/screenshots/commercial-audit.png`
- `docs/assets/screenshots/commercial-simulation.png`
- `docs/assets/demo/pilot-demo-output.json`
- `docs/assets/demo/commercial-proof-report.json`

## How Buyers Should Evaluate It

The right question is not "Can the model do the task?"

The right question is "Can the platform do the task without breaking the enterprise's control requirements?"

Use this evaluation sequence:

1. Run the pilot in simulation mode.
2. Trigger a live workflow that should require approval.
3. Confirm the workflow blocks before the sensitive action.
4. Approve the action from the approval inbox.
5. Confirm the workflow completes only after approval.
6. Inspect the audit trail and evidence IDs.
7. Review the generated commercial proof report.

If those steps are not observable, the claim is not commercial-grade.

## What EAOS Gives An Enterprise

### Operational value

- safer agent adoption in regulated workflows
- fewer manual handoffs for controlled actions
- better incident investigation and auditability
- lower vendor lock-in at the model layer
- a repeatable path from simulation to live operation

### Security value

- fewer leakage paths
- tighter outbound control
- clearer approval accountability
- explicit tenant isolation
- better forensics when something fails

### Buyer value

- a platform that can be evaluated with tests, not promises
- a control story that security teams can validate
- a workflow story that operators can understand
- a vendor-neutral architecture that avoids model dependency

## Bottom Line

EAOS is advanced because it treats enterprise agent behavior as a governed system, not a prompt experiment.

It is commercial-ready when the buyer can see all three of these at once:

- the workflow works
- the controls block unsafe behavior
- the evidence proves what happened

That is the bar this repository is designed to meet.
