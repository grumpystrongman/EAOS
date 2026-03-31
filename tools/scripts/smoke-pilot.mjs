#!/usr/bin/env node
import { once } from "node:events";
import { createAppServer } from "../../backend/services/api-gateway/src/index.ts";

const port = Number(process.env.OPENAEGIS_SMOKE_PORT ?? 3901);

const request = async (path, options = {}) => {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  const body = await response.json();
  return { status: response.status, body };
};

const run = async () => {
  process.env.OPENAEGIS_ENABLE_INSECURE_DEMO_AUTH = "true";
  const server = createAppServer();
  server.listen(port);
  await once(server, "listening");

  try {
    const login = await request("/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "clinician@starlighthealth.org" })
    });

    if (login.status !== 200) throw new Error("login failed");

    const execute = await request("/v1/executions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${login.body.accessToken}`
      },
      body: JSON.stringify({
        mode: "live",
        workflowId: "wf-discharge-assistant",
        patientId: "patient-1001",
        requestFollowupEmail: true
      })
    });

    if (execute.status !== 201 || execute.body.status !== "blocked") {
      throw new Error("expected blocked live execution with pending approval");
    }

    const approver = await request("/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "security@starlighthealth.org" })
    });

    const decision = await request(`/v1/approvals/${execute.body.approvalId}/decide`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${approver.body.accessToken}`
      },
      body: JSON.stringify({ decision: "approve", reason: "smoke test approval" })
    });

    if (decision.status !== 200) throw new Error("approval decision failed");

    const finalExecution = await request(`/v1/executions/${execute.body.executionId}`, {
      headers: { authorization: `Bearer ${login.body.accessToken}` }
    });

    if (finalExecution.body.status !== "completed") {
      throw new Error("execution did not complete after approval");
    }

    const audit = await request("/v1/audit/events", {
      headers: { authorization: `Bearer ${approver.body.accessToken}` }
    });

    if (audit.status !== 200 || !Array.isArray(audit.body.events) || audit.body.events.length === 0) {
      throw new Error("audit events not returned");
    }

    console.log("SMOKE TEST PASSED");
  } finally {
    server.close();
    await once(server, "close");
  }
};

run().catch((error) => {
  console.error("SMOKE TEST FAILED", error);
  process.exitCode = 1;
});

