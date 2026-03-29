import { useMemo } from "react";
import { usePilotWorkspace } from "../pilot-workspace.js";
import { Badge, EmptyState, KeyValueList, MetricTile, Panel, PageHeader, Table } from "../ui.js";

export const CommercialReadinessPage = () => {
  const commercialProof = usePilotWorkspace((state) => state.commercialProof);
  const commercialClaims = usePilotWorkspace((state) => state.commercialClaims);
  const commercialReadiness = usePilotWorkspace((state) => state.commercialReadiness);
  const refreshWorkspace = usePilotWorkspace((state) => state.refreshWorkspace);
  const isSyncing = usePilotWorkspace((state) => state.isSyncing);
  const clinicianSession = usePilotWorkspace((state) => state.clinicianSession);

  const summary = commercialReadiness?.summary;
  const claimRows = commercialReadiness?.claims ?? [];
  const proofClaims = commercialProof?.claims ?? [];
  const verificationClaims = commercialClaims?.claims ?? [];

  const metrics = useMemo(
    () =>
      summary
        ? [
            {
              label: "Commercial score",
              value: `${summary.score}%`,
              detail: `${summary.passedClaims}/${summary.totalClaims} claims passing`,
              tone: summary.score >= 85 ? ("success" as const) : summary.score >= 70 ? ("warning" as const) : ("danger" as const)
            },
            {
              label: "Audit evidence events",
              value: summary.auditEventCount,
              detail: "Evidence-linked control-plane history",
              tone: "info" as const
            },
            {
              label: "Pending approvals",
              value: summary.approvalTotals.pending,
              detail: "Human-in-the-loop control posture",
              tone: summary.approvalTotals.pending > 0 ? ("warning" as const) : ("success" as const)
            },
            {
              label: "Incident visibility",
              value: summary.incidentCount,
              detail: "Derived incidents ready for review",
              tone: summary.incidentCount > 0 ? ("warning" as const) : ("info" as const)
            }
          ]
        : [],
    [summary]
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Buyer proof"
        title="Commercial Readiness"
        subtitle="A live, test-backed scorecard showing whether EAOS delivers its core enterprise claims."
        actions={
          <>
            <button
              type="button"
              className="primary"
              onClick={() => void refreshWorkspace()}
              disabled={!clinicianSession || isSyncing}
            >
              Refresh proof data
            </button>
            <Badge tone="info">Evidence-first claims</Badge>
          </>
        }
      />

      {summary ? (
        <>
          <section className="metric-grid">
            {metrics.map((metric) => (
              <MetricTile key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} tone={metric.tone} />
            ))}
          </section>

          <section className="split-grid">
            <Panel title="What EAOS does" subtitle="Layperson view: practical outcomes instead of framework jargon.">
              <div className="stack">
                <div className="session-card">
                  <div>
                    <strong>Stops risky actions before they happen</strong>
                    <p>Live workflows pause for approval before high-risk outbound steps.</p>
                  </div>
                  <Badge tone="warning">Policy gate</Badge>
                </div>
                <div className="session-card">
                  <div>
                    <strong>Keeps a replayable evidence trail</strong>
                    <p>Every major action is tied to evidence IDs and searchable audit events.</p>
                  </div>
                  <Badge tone="success">Audit chain</Badge>
                </div>
                <div className="session-card">
                  <div>
                    <strong>Works across model and connector choices</strong>
                    <p>Vendor-neutral routing and signed connector manifests preserve enterprise control.</p>
                  </div>
                  <Badge tone="info">Vendor neutral</Badge>
                </div>
              </div>
            </Panel>

            <Panel title="Why this beats generic agent stacks" subtitle="IT and security view: control plane, not prompt tricks.">
              <KeyValueList
                items={[
                  { label: "Control boundary", value: "Policy and approval decisions are outside the model runtime." },
                  { label: "Execution safety", value: "Tool calls are guard-checked for action, network profile, budget, and approvals." },
                  { label: "Resilience", value: "Idempotency and deterministic graph checkpoints support reliable retries." },
                  { label: "Forensics", value: "Incident and audit surfaces expose who did what, when, and why." },
                  { label: "Commercial confidence", value: "Claims are tied to executable verification scripts and report artifacts." }
                ]}
              />
            </Panel>
          </section>

          <section className="split-grid">
            <Panel title="Runtime proof snapshot" subtitle="Live API signal from `/v1/commercial/proof`.">
              <KeyValueList
                items={[
                  { label: "Executions", value: commercialProof?.live.executions ?? 0 },
                  { label: "Approvals", value: commercialProof?.live.approvals ?? 0 },
                  { label: "Audit events", value: commercialProof?.live.auditEvents ?? 0 },
                  { label: "Graph executions", value: commercialProof?.live.graphExecutions ?? 0 },
                  { label: "Incidents", value: commercialProof?.live.incidents ?? 0 }
                ]}
              />
            </Panel>

            <Panel title="Verification summary" subtitle="Live API signal from `/v1/commercial/claims`.">
              <KeyValueList
                items={[
                  { label: "Total executions", value: commercialClaims?.executionTotals.total ?? 0 },
                  { label: "Completed executions", value: commercialClaims?.executionTotals.completed ?? 0 },
                  { label: "Blocked executions", value: commercialClaims?.executionTotals.blocked ?? 0 },
                  { label: "Failed executions", value: commercialClaims?.executionTotals.failed ?? 0 },
                  { label: "Open incidents", value: commercialClaims?.incidentTotals.open ?? 0 }
                ]}
              />
            </Panel>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Claims-to-evidence matrix</h3>
                <p className="panel-subtitle">Each claim must show status, test method, and evidence references.</p>
              </div>
            </div>
            <Table>
              <thead>
                <tr>
                  <th>Claim</th>
                  <th>Status</th>
                  <th>How tested</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {claimRows.map((claim) => (
                  <tr key={claim.claimId}>
                    <td>{claim.title}</td>
                    <td>
                      <Badge tone={claim.status === "pass" ? "success" : "warning"}>
                        {claim.status}
                      </Badge>
                    </td>
                    <td>{claim.howTested}</td>
                    <td>
                      <div className="pill-row">
                        {claim.evidence.slice(0, 3).map((evidenceId) => (
                          <Badge key={evidenceId} tone="info">
                            {evidenceId}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </section>

          <section className="split-grid">
            <Panel title="Proof claim health" subtitle="Status returned by `/v1/commercial/proof`.">
              <div className="pill-row">
                {proofClaims.map((claim) => (
                  <Badge key={claim.id} tone={claim.status === "pass" ? "success" : claim.status === "fail" ? "danger" : "warning"}>
                    {claim.id}:{claim.status}
                  </Badge>
                ))}
              </div>
            </Panel>

            <Panel title="Verification claims" subtitle="Status returned by `/v1/commercial/claims`.">
              <div className="pill-row">
                {verificationClaims.map((claim) => (
                  <Badge key={claim.claimId} tone={claim.status === "verified" ? "success" : "warning"}>
                    {claim.claimId}:{claim.status}
                  </Badge>
                ))}
              </div>
            </Panel>
          </section>

          <section className="split-grid">
            <Panel title="How we prove claims" subtitle="These checks are executable in this repository.">
              <div className="stack">
                <code>npm run smoke:pilot</code>
                <code>node tools/scripts/pilot-demo.mjs</code>
                <code>node tools/scripts/commercial-proof.mjs</code>
              </div>
            </Panel>

            <Panel title="Readiness snapshot details" subtitle="Current operational counts from the live control plane.">
              <KeyValueList
                items={[
                  { label: "Executions total", value: summary.executionTotals.total },
                  { label: "Executions blocked", value: summary.executionTotals.blocked },
                  { label: "Executions completed", value: summary.executionTotals.completed },
                  { label: "Executions failed", value: summary.executionTotals.failed },
                  { label: "Approvals approved", value: summary.approvalTotals.approved },
                  { label: "Approvals rejected", value: summary.approvalTotals.rejected }
                ]}
              />
            </Panel>
          </section>
        </>
      ) : (
        <Panel title="No readiness snapshot yet" subtitle="Connect demo sessions and refresh workspace to load proof metrics.">
          <EmptyState
            title="Proof data unavailable"
            description="Commercial readiness metrics are delivered by the live API endpoint `/v1/commercial/readiness`."
            action={
              <button
                type="button"
                className="primary"
                onClick={() => void refreshWorkspace()}
                disabled={!clinicianSession || isSyncing}
              >
                Refresh workspace
              </button>
            }
          />
        </Panel>
      )}
    </div>
  );
};
