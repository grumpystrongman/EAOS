import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { once } from "node:events";
import { createAppServer } from "./index.js";

const baseUrl = "http://127.0.0.1:3900";
let server: ReturnType<typeof createAppServer>;

beforeEach(async () => {
  await rm(".volumes/pilot-state.json", { force: true });
  server = createAppServer();
  server.listen(3900);
  await once(server, "listening");
});

test.afterEach(async () => {
  server.close();
  await once(server, "close");
});

test("pilot workflow requires approval in live mode and completes after approval", async () => {
  const login = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "clinician@starlighthealth.org" })
  });
  assert.equal(login.status, 200);
  const authBody = (await login.json()) as { accessToken: string; user: { userId: string } };

  const execute = await fetch(`${baseUrl}/v1/executions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${authBody.accessToken}`
    },
    body: JSON.stringify({
      mode: "live",
      workflowId: "wf-discharge-assistant",
      patientId: "patient-1001",
      requestFollowupEmail: true
    })
  });

  assert.equal(execute.status, 201);
  const execution = (await execute.json()) as { executionId: string; status: string; approvalId?: string };
  assert.equal(execution.status, "blocked");
  assert.ok(execution.approvalId);

  const approverLogin = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "security@starlighthealth.org" })
  });
  const approver = (await approverLogin.json()) as { accessToken: string };

  const decision = await fetch(`${baseUrl}/v1/approvals/${execution.approvalId}/decide`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${approver.accessToken}`
    },
    body: JSON.stringify({ decision: "approve", reason: "Validated discharge criteria" })
  });

  assert.equal(decision.status, 200);

  const executionAfter = await fetch(`${baseUrl}/v1/executions/${execution.executionId}`, {
    headers: { authorization: `Bearer ${authBody.accessToken}` }
  });
  const finalExecution = (await executionAfter.json()) as { status: string; toolCalls: string[] };
  assert.equal(finalExecution.status, "completed");
  assert.ok(finalExecution.toolCalls.length >= 3);

  const graph = await fetch(`${baseUrl}/v1/executions/${execution.executionId}/graph`, {
    headers: { authorization: `Bearer ${authBody.accessToken}` }
  });
  assert.equal(graph.status, 200);
  const graphBody = (await graph.json()) as {
    graphExecution: { status: string; steps: Array<{ stage: string; status: string }> };
  };
  assert.equal(graphBody.graphExecution.status, "completed");
  assert.deepEqual(
    graphBody.graphExecution.steps.map((step) => step.stage),
    ["planner", "executor", "reviewer"]
  );
  assert.equal(graphBody.graphExecution.steps[2]?.status, "completed");

  const audit = await fetch(`${baseUrl}/v1/audit/events`, {
    headers: { authorization: `Bearer ${authBody.accessToken}` }
  });
  assert.equal(audit.status, 200);
  const auditBody = (await audit.json()) as { events: Array<{ category: string }> };
  assert.ok(auditBody.events.some((event) => event.category === "workflow"));
  assert.ok(auditBody.events.some((event) => event.category === "approval"));
});

test("simulation mode completes without approval", async () => {
  const login = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "clinician@starlighthealth.org" })
  });
  const authBody = (await login.json()) as { accessToken: string };

  const execute = await fetch(`${baseUrl}/v1/executions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${authBody.accessToken}`
    },
    body: JSON.stringify({
      mode: "simulation",
      workflowId: "wf-discharge-assistant",
      patientId: "patient-1001",
      requestFollowupEmail: true
    })
  });

  const execution = (await execute.json()) as { status: string; approvalId?: string };
  assert.equal(execution.status, "completed");
  assert.equal(execution.approvalId, undefined);
});

test("reviewer rejection creates an incident and records graph steps", async () => {
  const login = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "clinician@starlighthealth.org" })
  });
  const authBody = (await login.json()) as { accessToken: string };

  const execute = await fetch(`${baseUrl}/v1/executions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${authBody.accessToken}`
    },
    body: JSON.stringify({
      mode: "simulation",
      workflowId: "wf-discharge-assistant",
      patientId: "patient-2002",
      requestFollowupEmail: true
    })
  });

  assert.equal(execute.status, 201);
  const execution = (await execute.json()) as { status: string; incidentId?: string; executionId: string };
  assert.equal(execution.status, "failed");
  assert.ok(execution.incidentId);

  const graph = await fetch(`${baseUrl}/v1/executions/${execution.executionId}/graph`, {
    headers: { authorization: `Bearer ${authBody.accessToken}` }
  });
  const graphBody = (await graph.json()) as {
    graphExecution: { status: string; currentStage: string; steps: Array<{ stage: string; status: string }> };
  };
  assert.equal(graphBody.graphExecution.status, "failed");
  assert.equal(graphBody.graphExecution.currentStage, "review_rejected");
  assert.deepEqual(
    graphBody.graphExecution.steps.map((step) => step.stage),
    ["planner", "executor", "reviewer"]
  );
  assert.equal(graphBody.graphExecution.steps[2]?.status, "failed");

  const incident = await fetch(`${baseUrl}/v1/incidents/${execution.incidentId}`, {
    headers: { authorization: `Bearer ${authBody.accessToken}` }
  });
  assert.equal(incident.status, 200);
  const incidentBody = (await incident.json()) as { category: string; executionId: string };
  assert.equal(incidentBody.category, "review_rejection");
  assert.equal(incidentBody.executionId, execution.executionId);
});

test("policy violation creates an incident before tool execution", async () => {
  const login = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "clinician@starlighthealth.org" })
  });
  const authBody = (await login.json()) as { accessToken: string };

  const execute = await fetch(`${baseUrl}/v1/executions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${authBody.accessToken}`
    },
    body: JSON.stringify({
      mode: "simulation",
      workflowId: "wf-discharge-assistant",
      patientId: "patient-1001",
      requestFollowupEmail: true,
      zeroRetentionRequested: false
    })
  });

  assert.equal(execute.status, 201);
  const execution = (await execute.json()) as { status: string; incidentId?: string; toolCalls: string[]; executionId: string };
  assert.equal(execution.status, "failed");
  assert.ok(execution.incidentId);
  assert.equal(execution.toolCalls.length, 0);

  const incidents = await fetch(`${baseUrl}/v1/incidents`, {
    headers: { authorization: `Bearer ${authBody.accessToken}` }
  });
  assert.equal(incidents.status, 200);
  const incidentsBody = (await incidents.json()) as { incidents: Array<{ incidentId: string; category: string }> };
  assert.ok(incidentsBody.incidents.some((item) => item.incidentId === execution.incidentId && item.category === "policy_violation"));
});
