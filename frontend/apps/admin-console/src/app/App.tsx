import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { APP_ROUTES } from "./routes.js";
import { pilotApi, type ApprovalRecord, type AuditEvent, type ExecutionRecord, type LoginResponse } from "../shared/api/pilot.js";

interface SessionBundle {
  clinician?: LoginResponse;
  approver?: LoginResponse;
}

const renderStatus = (value: string) => {
  const className = value.includes("blocked") ? "blocked" : value.includes("pending") ? "pending" : "completed";
  return <span className={`badge ${className}`}>{value}</span>;
};

export const App = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionBundle>({});
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [modelPreview, setModelPreview] = useState<{ provider: string; modelId: string; zeroRetention: boolean; reasonCodes: string[] }>();
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState<string>("");

  const currentPath = location.pathname === "/" ? "/dashboard" : location.pathname;

  const metrics = useMemo(() => {
    const blocked = executions.filter((item) => item.status === "blocked").length;
    const completed = executions.filter((item) => item.status === "completed").length;
    const pendingApprovals = approvals.filter((item) => item.status === "pending").length;
    return { blocked, completed, pendingApprovals, auditCount: auditEvents.length };
  }, [executions, approvals, auditEvents]);

  const refreshData = async () => {
    if (!session.clinician?.accessToken) return;
    const [approvalResult, auditResult, modelResult] = await Promise.all([
      pilotApi.listApprovals(session.clinician.accessToken),
      pilotApi.listAuditEvents(session.clinician.accessToken),
      pilotApi.previewModelRoute(session.clinician.accessToken)
    ]);
    setApprovals(approvalResult.approvals);
    setAuditEvents(auditResult.events);
    setModelPreview(modelResult.selected);
  };

  useEffect(() => {
    void refreshData();
  }, [session.clinician?.accessToken]);

  const loginUsers = async () => {
    setBusy("login");
    setError("");
    try {
      const [clinician, approver] = await Promise.all([
        pilotApi.login("clinician@starlighthealth.org"),
        pilotApi.login("security@starlighthealth.org")
      ]);
      setSession({ clinician, approver });
    } catch (err) {
      setError(err instanceof Error ? err.message : "login_failed");
    } finally {
      setBusy("");
    }
  };

  const runExecution = async (mode: "simulation" | "live") => {
    if (!session.clinician?.accessToken) {
      setError("login_required");
      return;
    }

    setBusy(`run-${mode}`);
    setError("");
    try {
      const execution = await pilotApi.runExecution(session.clinician.accessToken, mode, true);
      setExecutions((prev) => [execution, ...prev]);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "execution_failed");
    } finally {
      setBusy("");
    }
  };

  const approveFirstPending = async (decision: "approve" | "reject") => {
    if (!session.approver?.accessToken) {
      setError("approver_login_required");
      return;
    }

    const pending = approvals.find((item) => item.status === "pending");
    if (!pending) {
      setError("no_pending_approvals");
      return;
    }

    setBusy(decision);
    setError("");
    try {
      await pilotApi.decideApproval(session.approver.accessToken, pending.approvalId, decision, `UI ${decision} action`);
      if (pending.executionId && session.clinician?.accessToken) {
        const updatedExecution = await pilotApi.getExecution(session.clinician.accessToken, pending.executionId);
        setExecutions((prev) => prev.map((item) => (item.executionId === updatedExecution.executionId ? updatedExecution : item)));
      }
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "approval_failed");
    } finally {
      setBusy("");
    }
  };

  const routeTitle = APP_ROUTES.find((item) => item.path === currentPath)?.title ?? "EAOS";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>EAOS Pilot Console</h1>
        <div className="sub">Hospital discharge assistant workflow</div>
        <div className="nav-list">
          {APP_ROUTES.map((route) => (
            <button
              key={route.path}
              className={`nav-item ${route.path === currentPath ? "active" : ""}`}
              onClick={() => navigate(route.path)}
            >
              {route.title}
            </button>
          ))}
        </div>
      </aside>

      <main className="main">
        <h2>{routeTitle}</h2>
        <div className="toolbar">
          <button className="primary" onClick={() => void loginUsers()} disabled={busy === "login"}>
            {session.clinician ? "Re-authenticate Demo Users" : "Login Demo Users"}
          </button>
          <button onClick={() => void runExecution("simulation")} disabled={!session.clinician || busy !== ""}>Run Simulation</button>
          <button className="success" onClick={() => void runExecution("live")} disabled={!session.clinician || busy !== ""}>Run Live Workflow</button>
          <button onClick={() => void approveFirstPending("approve")} disabled={!session.approver || busy !== ""}>Approve Pending</button>
          <button className="danger" onClick={() => void approveFirstPending("reject")} disabled={!session.approver || busy !== ""}>Reject Pending</button>
        </div>

        {error ? <p style={{ color: "#b42318" }}>Error: {error}</p> : null}

        <div className="grid">
          <section className="card">
            <h3>Pilot Use Case</h3>
            <p className="muted">
              Workflow: <strong>Discharge Readiness Assistant</strong>.
              The agent reads FHIR patient data and SQL care-plan tasks, routes inference to a policy-approved model,
              and escalates human approval before sending a follow-up email.
            </p>
            <ul>
              <li>Tenant: tenant-starlight-health</li>
              <li>Classification: EPHI</li>
              <li>Zero-retention routing: enforced</li>
              <li>Approval gate: high-risk outbound communication</li>
            </ul>
          </section>

          <section className="card">
            <h3>KPI Snapshot</h3>
            <table>
              <tbody>
                <tr><td>Completed Executions</td><td>{metrics.completed}</td></tr>
                <tr><td>Blocked Executions</td><td>{metrics.blocked}</td></tr>
                <tr><td>Pending Approvals</td><td>{metrics.pendingApprovals}</td></tr>
                <tr><td>Audit Events</td><td>{metrics.auditCount}</td></tr>
              </tbody>
            </table>
          </section>

          <section className="card">
            <h3>Model Route Preview</h3>
            {modelPreview ? (
              <>
                <p><strong>{modelPreview.provider}</strong> / {modelPreview.modelId}</p>
                <p>Zero-retention: {modelPreview.zeroRetention ? "enabled" : "disabled"}</p>
                <p className="muted">Reason codes: {modelPreview.reasonCodes.join(", ")}</p>
              </>
            ) : (
              <p className="muted">Login to fetch route preview.</p>
            )}
          </section>
        </div>

        <section className="card" style={{ marginTop: 14 }}>
          <h3>Executions</h3>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Step</th>
                <th>Approval</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((execution) => (
                <tr key={execution.executionId}>
                  <td>{execution.executionId}</td>
                  <td>{execution.mode}</td>
                  <td>{renderStatus(execution.status)}</td>
                  <td>{execution.currentStep}</td>
                  <td>{execution.approvalId ?? "-"}</td>
                  <td>{new Date(execution.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
              {executions.length === 0 ? (
                <tr><td colSpan={6} className="muted">No executions yet. Start with Simulation.</td></tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="card" style={{ marginTop: 14 }}>
          <h3>Approval Inbox</h3>
          <table>
            <thead>
              <tr>
                <th>Approval ID</th>
                <th>Status</th>
                <th>Risk</th>
                <th>Reason</th>
                <th>Execution</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((approval) => (
                <tr key={approval.approvalId}>
                  <td>{approval.approvalId}</td>
                  <td>{renderStatus(approval.status)}</td>
                  <td>{approval.riskLevel}</td>
                  <td>{approval.reason}</td>
                  <td>{approval.executionId ?? "-"}</td>
                </tr>
              ))}
              {approvals.length === 0 ? (
                <tr><td colSpan={5} className="muted">No approvals created yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="card" style={{ marginTop: 14 }}>
          <h3>Audit Explorer</h3>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Category</th>
                <th>Action</th>
                <th>Status</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map((event) => (
                <tr key={event.eventId}>
                  <td>{new Date(event.timestamp).toLocaleString()}</td>
                  <td>{event.category}</td>
                  <td>{event.action}</td>
                  <td>{renderStatus(event.status)}</td>
                  <td>{event.evidenceId}</td>
                </tr>
              ))}
              {auditEvents.length === 0 ? (
                <tr><td colSpan={5} className="muted">No audit events yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
};