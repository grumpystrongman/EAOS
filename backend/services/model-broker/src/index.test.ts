import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { rm } from "node:fs/promises";
import { createAppServer } from "./index.ts";

const port = 3921;
const baseUrl = `http://127.0.0.1:${port}`;
let server: ReturnType<typeof createAppServer>;

beforeEach(async () => {
  await rm(".volumes/model-broker-state.json", { force: true });
  server = createAppServer();
  server.listen(port);
  await once(server, "listening");
});

test.afterEach(async () => {
  server.close();
  await once(server, "close");
});

test("evaluates model route and persists tenant decision history", async () => {
  const capabilityResponse = await fetch(`${baseUrl}/v1/model-broker/providers/capabilities`, {
    headers: {
      "x-tenant-id": "tenant-starlight-health",
      "x-actor-id": "user-clinician",
      "x-roles": "workflow_operator"
    }
  });
  assert.equal(capabilityResponse.status, 200);
  const capabilitiesBody = (await capabilityResponse.json()) as {
    providers: Array<{
      provider: string;
      modelId: string;
      deploymentType: string;
      authModes: string[];
      zeroRetentionFlags: string[];
      supportsZeroRetention: boolean;
    }>;
  };
  assert.ok(capabilitiesBody.providers.length >= 10);

  const openaiNano = capabilitiesBody.providers.find((provider) => provider.modelId === "gpt-4.1-nano");
  assert.ok(openaiNano);
  assert.equal(openaiNano?.deploymentType, "hosted");
  assert.ok(openaiNano?.authModes.includes("api_key"));
  assert.ok(openaiNano?.zeroRetentionFlags.includes("supported"));
  assert.equal(openaiNano?.supportsZeroRetention, true);

  const azureMini = capabilitiesBody.providers.find((provider) => provider.modelId === "azure-gpt-4.1-mini");
  assert.ok(azureMini);
  assert.equal(azureMini?.deploymentType, "azure_hosted");
  assert.ok(azureMini?.authModes.includes("managed_identity"));

  const googleFlash = capabilitiesBody.providers.find((provider) => provider.modelId === "gemini-2.5-flash");
  assert.ok(googleFlash);
  assert.equal(googleFlash?.supportsZeroRetention, false);
  assert.ok(googleFlash?.zeroRetentionFlags.includes("unsupported"));

  const selfHostedSmall = capabilitiesBody.providers.find((provider) => provider.modelId === "llama-3.1-8b-private");
  assert.ok(selfHostedSmall);
  assert.equal(selfHostedSmall?.deploymentType, "self_hosted");
  assert.ok(selfHostedSmall?.zeroRetentionFlags.includes("customer_enforced"));

  const evaluateResponse = await fetch(`${baseUrl}/v1/model-broker/routes/evaluate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "tenant-starlight-health",
      "x-actor-id": "user-clinician",
      "x-roles": "workflow_operator"
    },
    body: JSON.stringify({
      sensitivity: "EPHI",
      requiredCapabilities: ["json_schema", "tool_use"],
      zeroRetentionRequired: true,
      maxLatencyMs: 3000,
      costCeiling: "high"
    })
  });
  assert.equal(evaluateResponse.status, 200);
  const evaluateBody = (await evaluateResponse.json()) as {
    decisionId: string;
    selected: { provider: string; modelId: string; supportsZeroRetention: boolean; deploymentType: string };
    routeReasonCodes: string[];
  };
  assert.ok(evaluateBody.decisionId.startsWith("route-"));
  assert.equal(evaluateBody.selected.supportsZeroRetention, true);
  assert.equal(evaluateBody.selected.deploymentType, "self_hosted");
  assert.ok(evaluateBody.routeReasonCodes.includes("policy.sensitivity.ephi.compatible"));
  assert.ok(evaluateBody.routeReasonCodes.includes("policy.risk.selected.low"));

  const decisionsResponse = await fetch(`${baseUrl}/v1/model-broker/routes/decisions`, {
    headers: {
      "x-tenant-id": "tenant-starlight-health",
      "x-actor-id": "user-security",
      "x-roles": "auditor"
    }
  });
  assert.equal(decisionsResponse.status, 200);
  const decisionsBody = (await decisionsResponse.json()) as { decisions: Array<{ decisionId: string }> };
  assert.equal(decisionsBody.decisions.length, 1);
  assert.equal(decisionsBody.decisions[0]?.decisionId, evaluateBody.decisionId);
});

test("routes to the lowest-cost openai variant while surfacing cost and performance block codes", async () => {
  const response = await fetch(`${baseUrl}/v1/model-broker/routes/evaluate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "tenant-starlight-health",
      "x-actor-id": "user-clinician",
      "x-roles": "workflow_operator"
    },
    body: JSON.stringify({
      sensitivity: "PUBLIC",
      requiredCapabilities: ["json_schema", "tool_use"],
      zeroRetentionRequired: true,
      maxLatencyMs: 900,
      costCeiling: "low",
      providerAllowList: ["openai"]
    })
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    selected: { provider: string; modelId: string; deploymentType: string };
    fallback: Array<{ modelId: string }>;
    blockedCandidates: Array<{ modelId: string; reasonCodes: string[] }>;
    routeReasonCodes: string[];
  };

  assert.equal(body.selected.provider, "openai");
  assert.equal(body.selected.modelId, "gpt-4.1-nano");
  assert.equal(body.selected.deploymentType, "hosted");
  assert.equal(body.fallback[0]?.modelId, "gpt-4.1-mini");
  assert.ok(body.routeReasonCodes.includes("policy.cost.within_ceiling.low"));
  assert.ok(body.routeReasonCodes.includes("policy.performance.within_latency_budget"));

  const blockedGpt41 = body.blockedCandidates.find((candidate) => candidate.modelId === "gpt-4.1");
  assert.ok(blockedGpt41);
  assert.ok(blockedGpt41?.reasonCodes.includes("policy.cost.exceeds_ceiling.low"));
  assert.ok(blockedGpt41?.reasonCodes.includes("policy.performance.exceeds_latency_budget"));
});

test("routes secret workloads to self-hosted models and records sensitivity and risk reasons", async () => {
  const response = await fetch(`${baseUrl}/v1/model-broker/routes/evaluate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "tenant-starlight-health",
      "x-actor-id": "user-security",
      "x-roles": "security_admin"
    },
    body: JSON.stringify({
      sensitivity: "SECRET",
      requiredCapabilities: ["json_schema", "tool_use"],
      zeroRetentionRequired: true,
      maxLatencyMs: 2500,
      costCeiling: "high"
    })
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    selected: { provider: string; modelId: string; deploymentType: string };
    blockedCandidates: Array<{ provider: string; reasonCodes: string[] }>;
    routeReasonCodes: string[];
  };

  assert.equal(body.selected.provider, "self_hosted");
  assert.equal(body.selected.deploymentType, "self_hosted");
  assert.equal(body.selected.modelId, "llama-3.1-8b-private");
  assert.ok(body.routeReasonCodes.includes("policy.sensitivity.secret.compatible"));
  assert.ok(body.routeReasonCodes.includes("policy.risk.selected.low"));

  const nonSelfHostedBlocked = body.blockedCandidates.filter((candidate) => candidate.provider !== "self_hosted");
  assert.ok(nonSelfHostedBlocked.length >= 1);
  assert.ok(
    nonSelfHostedBlocked.every((candidate) =>
      candidate.reasonCodes.includes("policy.sensitivity.secret.requires_self_hosted") ||
      candidate.reasonCodes.includes("policy.risk.high_tier_excluded_for_sensitive_data") ||
      candidate.reasonCodes.includes("policy.zero_retention.unsupported")
    )
  );
});

test("denies route evaluation without actor context", async () => {
  const response = await fetch(`${baseUrl}/v1/model-broker/routes/evaluate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "tenant-starlight-health",
      "x-roles": "workflow_operator"
    },
    body: JSON.stringify({
      sensitivity: "PUBLIC",
      requiredCapabilities: ["json_schema"],
      zeroRetentionRequired: false,
      maxLatencyMs: 2000
    })
  });

  assert.equal(response.status, 401);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, "actor_context_required");
});
