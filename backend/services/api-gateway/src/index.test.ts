import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { once } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
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

test("commercial proof endpoint returns live claim snapshot", async () => {
  const login = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "clinician@starlighthealth.org" })
  });
  assert.equal(login.status, 200);
  const authBody = (await login.json()) as { accessToken: string };

  const proof = await fetch(`${baseUrl}/v1/commercial/proof`, {
    headers: { authorization: `Bearer ${authBody.accessToken}` }
  });
  assert.equal(proof.status, 200);
  const body = (await proof.json()) as {
    live: { executions: number };
    claims: Array<{ id: string; status: string }>;
  };
  assert.ok(typeof body.live.executions === "number");
  assert.ok(body.claims.length >= 4);
  assert.ok(body.claims.some((claim) => claim.id === "audit-evidence-coverage"));
});

test("commercial readiness endpoint returns claim scorecard", async () => {
  const login = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "clinician@starlighthealth.org" })
  });
  const authBody = (await login.json()) as { accessToken: string };

  const readiness = await fetch(`${baseUrl}/v1/commercial/readiness`, {
    headers: { authorization: `Bearer ${authBody.accessToken}` }
  });
  assert.equal(readiness.status, 200);
  const body = (await readiness.json()) as {
    generatedAt: string;
    summary: { score: number; totalClaims: number; passedClaims: number };
    claims: Array<{ claimId: string; status: string }>;
  };
  assert.ok(typeof body.generatedAt === "string");
  assert.equal(body.summary.totalClaims, 4);
  assert.ok(body.summary.score >= 0 && body.summary.score <= 100);
  assert.equal(body.claims.length, 4);
  assert.ok(body.claims.some((claim) => claim.claimId === "immutable_audit_chain"));
});

test("commercial claims endpoint returns verification summary", async () => {
  const login = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "clinician@starlighthealth.org" })
  });
  const authBody = (await login.json()) as { accessToken: string };

  await fetch(`${baseUrl}/v1/executions`, {
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

  const claimsResponse = await fetch(`${baseUrl}/v1/commercial/claims`, {
    headers: { authorization: `Bearer ${authBody.accessToken}` }
  });
  assert.equal(claimsResponse.status, 200);
  const claims = (await claimsResponse.json()) as {
    executionTotals: { total: number };
    claims: Array<{ claimId: string; status: string }>;
  };
  assert.ok(claims.executionTotals.total >= 1);
  assert.ok(claims.claims.some((claim) => claim.claimId === "policy_gates_enforced"));
});

test("policy profile endpoints preview and save controls with role checks", async () => {
  const clinicianLogin = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "clinician@starlighthealth.org" })
  });
  const clinician = (await clinicianLogin.json()) as { accessToken: string };

  const securityLogin = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "security@starlighthealth.org" })
  });
  const security = (await securityLogin.json()) as { accessToken: string };

  const preview = await fetch(`${baseUrl}/v1/policies/profile/preview`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${security.accessToken}`
    },
    body: JSON.stringify({
      profileName: "Less strict approvals",
      controls: {
        requireApprovalForHighRiskLive: false
      }
    })
  });
  assert.equal(preview.status, 200);
  const previewBody = (await preview.json()) as {
    validation: { valid: boolean; issues: Array<{ code: string; severity: string }> };
  };
  assert.equal(previewBody.validation.valid, true);
  assert.ok(previewBody.validation.issues.some((issue) => issue.code === "high_risk_approval_disabled"));

  const deniedSave = await fetch(`${baseUrl}/v1/policies/profile/save`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${clinician.accessToken}`
    },
    body: JSON.stringify({
      changeSummary: "Trying to save without security role",
      controls: { requireApprovalForHighRiskLive: false }
    })
  });
  assert.equal(deniedSave.status, 403);

  const saved = await fetch(`${baseUrl}/v1/policies/profile/save`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${security.accessToken}`
    },
    body: JSON.stringify({
      changeSummary: "Temporary reduction for pilot demonstration",
      controls: { requireApprovalForHighRiskLive: false }
    })
  });
  assert.equal(saved.status, 200);

  const execute = await fetch(`${baseUrl}/v1/executions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${clinician.accessToken}`
    },
    body: JSON.stringify({
      mode: "live",
      workflowId: "wf-discharge-assistant",
      patientId: "patient-1001",
      requestFollowupEmail: true
    })
  });
  assert.equal(execute.status, 201);
  const execution = (await execute.json()) as { status: string; approvalId?: string };
  assert.equal(execution.status, "completed");
  assert.equal(execution.approvalId, undefined);
});

test("blocking policy changes require break-glass fields", async () => {
  const securityLogin = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "security@starlighthealth.org" })
  });
  const security = (await securityLogin.json()) as { accessToken: string };

  const denied = await fetch(`${baseUrl}/v1/policies/profile/save`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${security.accessToken}`
    },
    body: JSON.stringify({
      changeSummary: "Unsafe change without break-glass",
      controls: { enforceSecretDeny: false }
    })
  });
  assert.equal(denied.status, 422);
  const deniedBody = (await denied.json()) as { error: string };
  assert.equal(deniedBody.error, "break_glass_required_for_blocking_policy_changes");

  const approved = await fetch(`${baseUrl}/v1/policies/profile/save`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${security.accessToken}`
    },
    body: JSON.stringify({
      changeSummary: "Emergency break-glass test",
      controls: { enforceSecretDeny: false },
      breakGlass: {
        ticketId: "BG-2026-001",
        justification: "Emergency scenario validation under supervision.",
        approverIds: ["security-lead-1", "compliance-lead-2"]
      }
    })
  });
  assert.equal(approved.status, 200);
  const approvedBody = (await approved.json()) as { breakGlassUsed: boolean };
  assert.equal(approvedBody.breakGlassUsed, true);
});

test("policy copilot endpoint returns actionable guidance", async () => {
  const login = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "security@starlighthealth.org" })
  });
  const authBody = (await login.json()) as { accessToken: string };

  const response = await fetch(`${baseUrl}/v1/policies/profile/copilot`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${authBody.accessToken}`
    },
    body: JSON.stringify({
      operatorGoal: "Keep this safe for patient data and easy for new staff.",
      controls: {
        requireApprovalForHighRiskLive: false,
        maxToolCallsPerExecution: 18
      }
    })
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    source: string;
    hints: string[];
    suggestedControls: { requireApprovalForHighRiskLive: boolean };
  };
  assert.ok(body.source === "builtin" || body.source === "local-llm");
  assert.ok(body.hints.length >= 2);
  assert.equal(body.suggestedControls.requireApprovalForHighRiskLive, true);
});

test("policy explain endpoint returns plain-language impact and safe advisor output", async () => {
  const login = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "security@starlighthealth.org" })
  });
  const authBody = (await login.json()) as { accessToken: string };

  const response = await fetch(`${baseUrl}/v1/policies/profile/explain`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${authBody.accessToken}`
    },
    body: JSON.stringify({
      operatorGoal: "Make this easy for new staff but keep strict safety controls.",
      controls: {
        requireApprovalForHighRiskLive: false,
        maxToolCallsPerExecution: 16
      }
    })
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    explainability: {
      posture: "improved" | "degraded" | "unchanged";
      riskDelta: number;
      controls: Array<{ control: string; changed: boolean }>;
      nextSteps: string[];
    };
    advisor: {
      source: "local-llm" | "builtin";
      confidence: number;
      hints: string[];
      suggestedControls: { requireApprovalForHighRiskLive: boolean };
    };
  };
  assert.equal(body.explainability.posture, "degraded");
  assert.ok(body.explainability.riskDelta > 0);
  assert.ok(body.explainability.controls.some((item) => item.control === "requireApprovalForHighRiskLive" && item.changed));
  assert.ok(body.explainability.nextSteps.length >= 3);
  assert.ok(body.advisor.source === "builtin" || body.advisor.source === "local-llm");
  assert.ok(body.advisor.hints.length >= 2);
  assert.ok(body.advisor.confidence > 0);
  assert.equal(body.advisor.suggestedControls.requireApprovalForHighRiskLive, true);
});

test("gateway supports auth-service token introspection and enforces tenant scope", async () => {
  const introspectionServer = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "POST" || request.url !== "/v1/auth/introspect") {
      response.writeHead(404).end();
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { token?: string };

    if (payload.token === "oidc-security-good") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          active: true,
          sub: "user-security",
          tenantId: "tenant-starlight-health",
          roles: ["security_admin", "platform_admin"],
          assuranceLevel: "aal3"
        })
      );
      return;
    }

    if (payload.token === "oidc-cross-tenant") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          active: true,
          sub: "user-security",
          tenantId: "tenant-other",
          roles: ["security_admin"],
          assuranceLevel: "aal3"
        })
      );
      return;
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ active: false }));
  });

  introspectionServer.listen(3912);
  await once(introspectionServer, "listening");

  process.env.OPENAEGIS_AUTH_INTROSPECTION_URL = "http://127.0.0.1:3912/v1/auth/introspect";
  process.env.OPENAEGIS_REQUIRE_INTROSPECTION = "true";

  try {
    const authorized = await fetch(`${baseUrl}/v1/policies/profile`, {
      headers: { authorization: "Bearer oidc-security-good" }
    });
    assert.equal(authorized.status, 200);

    const crossTenantDenied = await fetch(`${baseUrl}/v1/executions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer oidc-cross-tenant"
      },
      body: JSON.stringify({
        mode: "simulation",
        workflowId: "wf-discharge-assistant",
        patientId: "patient-1001",
        tenantId: "tenant-starlight-health"
      })
    });
    assert.equal(crossTenantDenied.status, 403);
    const crossBody = (await crossTenantDenied.json()) as { error: string };
    assert.equal(crossBody.error, "tenant_scope_mismatch");

    const inactive = await fetch(`${baseUrl}/v1/policies/profile`, {
      headers: { authorization: "Bearer unknown-token" }
    });
    assert.equal(inactive.status, 401);
  } finally {
    delete process.env.OPENAEGIS_AUTH_INTROSPECTION_URL;
    delete process.env.OPENAEGIS_REQUIRE_INTROSPECTION;
    introspectionServer.close();
    await once(introspectionServer, "close");
  }
});

test("rejects oversized payloads", async () => {
  const login = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "security@starlighthealth.org" })
  });
  const authBody = (await login.json()) as { accessToken: string };
  const oversized = "x".repeat(1024 * 1024 + 1024);

  const response = await fetch(`${baseUrl}/v1/policy/evaluate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${authBody.accessToken}`
    },
    body: JSON.stringify({ action: oversized })
  });

  assert.equal(response.status, 413);
});
