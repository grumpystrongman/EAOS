import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { rm } from "node:fs/promises";
import { createAppServer } from "./index.js";

const baseUrl = "http://127.0.0.1:3907";
let server: ReturnType<typeof createAppServer>;

beforeEach(async () => {
  await rm(".volumes/tool-execution-state.json", { force: true });
  server = createAppServer();
  server.listen(3907);
  await once(server, "listening");
});

test.afterEach(async () => {
  server.close();
  await once(server, "close");
});

test("allows simulated connector execution", async () => {
  const response = await fetch(`${baseUrl}/v1/tool-calls`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-actor-id": "user-clinician" },
    body: JSON.stringify({
      toolId: "connector-fhir-read",
      action: "READ",
      mode: "simulate",
      requestedNetworkProfile: "clinical-internal",
      stepBudgetRemaining: 2
    })
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { status: string; result: { operation: string } };
  assert.equal(body.status, "completed");
  assert.equal(body.result.operation, "mock_execution");
});

test("blocks execution when approval is required and missing", async () => {
  const response = await fetch(`${baseUrl}/v1/tool-calls`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-actor-id": "user-clinician" },
    body: JSON.stringify({
      toolId: "connector-email-notify",
      action: "EXECUTE",
      mode: "execute",
      requestedNetworkProfile: "outbound-approved",
      stepBudgetRemaining: 1,
      requiresApproval: true,
      approvalGranted: false
    })
  });

  assert.equal(response.status, 403);
  const body = (await response.json()) as { status: string; guardReason: string };
  assert.equal(body.status, "blocked");
  assert.equal(body.guardReason, "approval_missing");
});

test("replays idempotent calls for matching idempotency key", async () => {
  const headers = {
    "content-type": "application/json",
    "x-actor-id": "user-security",
    "idempotency-key": "idem-linear-001"
  };

  const body = {
    toolId: "connector-linear-project",
    action: "EXECUTE",
    mode: "simulate",
    requestedNetworkProfile: "project-ops",
    stepBudgetRemaining: 3,
    parameters: { project: "OpenAegis Commercial Ship" }
  };

  const first = await fetch(`${baseUrl}/v1/tool-calls`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  assert.equal(first.status, 200);
  const firstBody = (await first.json()) as { toolCallId: string; idempotentReplay?: boolean };
  assert.equal(firstBody.idempotentReplay, undefined);

  const second = await fetch(`${baseUrl}/v1/tool-calls`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  assert.equal(second.status, 200);
  const secondBody = (await second.json()) as { toolCallId: string; idempotentReplay?: boolean };
  assert.equal(secondBody.toolCallId, firstBody.toolCallId);
  assert.equal(secondBody.idempotentReplay, true);
});

