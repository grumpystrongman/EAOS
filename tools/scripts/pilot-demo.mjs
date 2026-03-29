#!/usr/bin/env node
import { once } from "node:events";
import { writeFile, mkdir } from "node:fs/promises";
import { createAppServer } from "../../backend/services/api-gateway/src/index.ts";

const port = Number(process.env.OPENAEGIS_DEMO_PORT ?? 3950);
const baseUrl = `http://127.0.0.1:${port}`;

const call = async (path, method = "GET", token, body) => {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  const payload = await response.json();
  return { status: response.status, payload };
};

const runDemo = async () => {
  const server = createAppServer();
  server.listen(port);
  await once(server, "listening");

  const report = {
    startedAt: new Date().toISOString(),
    useCase: "Hospital Discharge Readiness Assistant",
    steps: []
  };

  try {
    const clinician = await call("/v1/auth/login", "POST", undefined, { email: "clinician@starlighthealth.org" });
    const approver = await call("/v1/auth/login", "POST", undefined, { email: "security@starlighthealth.org" });

    report.steps.push({ name: "login_clinician", status: clinician.status, user: clinician.payload.user?.displayName });
    report.steps.push({ name: "login_approver", status: approver.status, user: approver.payload.user?.displayName });

    const liveExecution = await call("/v1/executions", "POST", clinician.payload.accessToken, {
      mode: "live",
      workflowId: "wf-discharge-assistant",
      patientId: "patient-1001",
      requestFollowupEmail: true
    });

    report.steps.push({
      name: "run_live_workflow",
      status: liveExecution.status,
      executionId: liveExecution.payload.executionId,
      workflowStatus: liveExecution.payload.status,
      approvalId: liveExecution.payload.approvalId
    });

    const decision = await call(`/v1/approvals/${liveExecution.payload.approvalId}/decide`, "POST", approver.payload.accessToken, {
      decision: "approve",
      reason: "Pilot demo approval"
    });

    report.steps.push({
      name: "approval_decision",
      status: decision.status,
      approvalStatus: decision.payload.status
    });

    const executionAfter = await call(`/v1/executions/${liveExecution.payload.executionId}`, "GET", clinician.payload.accessToken);
    const audit = await call("/v1/audit/events", "GET", clinician.payload.accessToken);

    report.steps.push({
      name: "execution_after_approval",
      status: executionAfter.status,
      workflowStatus: executionAfter.payload.status,
      model: executionAfter.payload.modelRoute?.modelId,
      evidenceId: executionAfter.payload.evidenceId
    });

    report.steps.push({
      name: "audit_events",
      status: audit.status,
      count: audit.payload.events?.length ?? 0,
      latestEvidence: audit.payload.events?.[0]?.evidenceId
    });

    report.completedAt = new Date().toISOString();

    await mkdir("docs/assets/demo", { recursive: true });
    await writeFile("docs/assets/demo/pilot-demo-output.json", JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify(report, null, 2));
  } finally {
    server.close();
    await once(server, "close");
  }
};

runDemo().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
