import { Link } from "react-router-dom";
import { Badge, Panel, PageHeader, Table } from "../ui.js";

const evaluatorGuideSteps = [
  "Open Setup Center and connect evaluator identities.",
  "Run one simulation to confirm the workflow can complete end-to-end.",
  "Open Project Packs and review one commercial scenario.",
  "Open Sandbox Proof to verify connectors and trust boundaries are visible.",
  "Open Audit Explorer and confirm replayable evidence exists."
];

const operatorGuideSteps = [
  "Verify integrations are configured and at least one is in verified state.",
  "Open Workflow Designer and confirm the active production workflow version.",
  "Run simulation first, then run live mode for operator validation.",
  "Process approvals in Approval Inbox and document rationale.",
  "Review incidents and audit history before production sign-off."
];

const governanceDecisions = [
  {
    decision: "Connector destination allowlist changes",
    owner: "Security admin",
    escalation: "Escalate when adding new external domains or cross-tenant data paths."
  },
  {
    decision: "Policy profile baseline tuning",
    owner: "Operations + Security",
    escalation: "Escalate when a change introduces blocking findings or break-glass fields."
  },
  {
    decision: "Role grants and assurance level upgrades",
    owner: "Platform admin",
    escalation: "Escalate when adding platform_admin or any AAL3 exception."
  },
  {
    decision: "Live workflow promotion",
    owner: "Operations lead",
    escalation: "Escalate when approvals are bypassed or incident count increases week-over-week."
  }
];

export const GuidesPage = () => (
  <div className="page-stack">
    <PageHeader
      eyebrow="Role-based onboarding"
      title="Evaluator and Operator Guides"
      subtitle="Use these guides as the single workflow path for each role. This page stays available in navigation for every session."
      actions={
        <>
          <Badge tone="info">Evaluator guide</Badge>
          <Badge tone="success">Operator runbook</Badge>
          <Badge tone="warning">Governance decisions</Badge>
        </>
      }
    />

    <section className="split-grid">
      <Panel title="Evaluator Demo Guide" subtitle="Fast path for assessments and stakeholder demos." tone="info">
        <ol className="plain-steps">
          {evaluatorGuideSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="guide-action-strip">
          <Link className="subtle-link" to="/setup">
            Open Setup Center
          </Link>
          <Link className="subtle-link" to="/projects">
            Open Project Packs
          </Link>
          <Link className="subtle-link" to="/sandbox-proof">
            Open Sandbox Proof
          </Link>
        </div>
      </Panel>

      <Panel title="Operator User Guide" subtitle="Daily operational sequence for controlled production runs." tone="success">
        <ol className="plain-steps">
          {operatorGuideSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="guide-action-strip">
          <Link className="subtle-link" to="/integrations">
            Open Integration Hub
          </Link>
          <Link className="subtle-link" to="/workflows">
            Open Workflow Designer
          </Link>
          <Link className="subtle-link" to="/approvals">
            Open Approval Inbox
          </Link>
        </div>
      </Panel>
    </section>

    <Panel
      title="Operations vs Governance Decision Register"
      subtitle="Operational teams can execute the defaults below. Escalate only when one of the governance conditions is true."
    >
      <div className="table-wrap">
        <Table>
          <thead>
            <tr>
              <th>Decision Area</th>
              <th>Owned By</th>
              <th>Escalate to Governance When</th>
            </tr>
          </thead>
          <tbody>
            {governanceDecisions.map((item) => (
              <tr key={item.decision}>
                <td>{item.decision}</td>
                <td>{item.owner}</td>
                <td>{item.escalation}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Panel>
  </div>
);
