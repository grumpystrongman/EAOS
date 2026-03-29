# EAOS Pilot Runbook

## Pilot Profile

- Name: Hospital Discharge Readiness Assistant
- Goal: Assist discharge planning while enforcing policy gates for high-risk actions
- Tenant: `tenant-starlight-health`
- Data sensitivity: `EPHI`

## What the Pilot Demonstrates

1. Model routing with zero-retention requirements
2. Policy decisioning (`ALLOW`, `DENY`, `REQUIRE_APPROVAL`)
3. Human approval gating before risky outbound actions
4. Immutable audit/evidence generation
5. Simulation and live execution modes

## Demo Flow

```mermaid
sequenceDiagram
    participant Clinician
    participant EAOS
    participant Policy
    participant Approval
    participant Model
    participant Audit

    Clinician->>EAOS: Start live discharge workflow
    EAOS->>Policy: Evaluate EPHI + high-risk action
    Policy-->>EAOS: REQUIRE_APPROVAL
    EAOS->>Approval: Create approval ticket
    Approval-->>Clinician: Approval needed
    Approver->>Approval: Approve
    EAOS->>Model: Run policy-approved inference
    EAOS->>Audit: Commit evidence envelope
    EAOS-->>Clinician: Completed workflow + trace
```

## Start the Pilot Locally

```bash
npm install
npm run build
npm run smoke:pilot
```

Optional explicit demo output:

```bash
node tools/scripts/pilot-demo.mjs
```

## Pilot UI Walkthrough

1. Open Admin Console and click **Login Demo Users**
2. Click **Run Live Workflow** to trigger a blocked execution
3. Open **Approval Inbox** and click **Approve Pending**
4. Verify execution is `completed`
5. Open **Audit Explorer** and inspect evidence IDs

## Screenshot Gallery

- Dashboard: `docs/assets/screenshots/dashboard-pilot.png`
- Admin Console: `docs/assets/screenshots/admin-console.png`
- Security Console: `docs/assets/screenshots/security-console.png`
- Workflow Designer: `docs/assets/screenshots/workflow-designer.png`
- Approval Inbox: `docs/assets/screenshots/approval-inbox.png`
- Incident Review: `docs/assets/screenshots/incident-review.png`
- Audit Explorer: `docs/assets/screenshots/audit-explorer.png`
- Simulation Lab: `docs/assets/screenshots/simulation-lab.png`

## Demo Artifact

- Machine-readable report: `docs/assets/demo/pilot-demo-output.json`

## Success Criteria

- Live run blocks pending approval
- Approval changes run state to completed
- Audit log includes workflow + approval events
- Evidence references are present in audit output