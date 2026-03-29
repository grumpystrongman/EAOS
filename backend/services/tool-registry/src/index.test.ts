import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { rm } from "node:fs/promises";
import { createAppServer } from "./index.js";

const baseUrl = "http://127.0.0.1:3906";
let server: ReturnType<typeof createAppServer>;

beforeEach(async () => {
  await rm(".volumes/tool-registry-state.json", { force: true });
  server = createAppServer();
  server.listen(3906);
  await once(server, "listening");
});

test.afterEach(async () => {
  server.close();
  await once(server, "close");
});

test("lists default published manifests including linear connector", async () => {
  const response = await fetch(`${baseUrl}/v1/tools?status=published`);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { manifests: Array<{ toolId: string; status: string }> };
  assert.ok(body.manifests.length >= 8);
  assert.ok(body.manifests.some((manifest) => manifest.toolId === "connector-linear-project"));
  assert.ok(body.manifests.every((manifest) => manifest.status === "published"));
});

test("creates a draft manifest and publishes it", async () => {
  const create = await fetch(`${baseUrl}/v1/tools`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-actor-id": "user-security"
    },
    body: JSON.stringify({
      toolId: "connector-custom-research",
      displayName: "Custom Research Connector",
      connectorType: "project",
      description: "Draft connector for research workflows",
      trustTier: "tier-3",
      allowedActions: ["READ", "EXECUTE"],
      permissionScopes: ["research.read", "research.execute"],
      outboundDomains: ["research.internal.local"],
      signature: "sig-custom-v1"
    })
  });
  assert.equal(create.status, 201);
  const created = (await create.json()) as { toolId: string; status: string };
  assert.equal(created.toolId, "connector-custom-research");
  assert.equal(created.status, "draft");

  const publish = await fetch(`${baseUrl}/v1/tools/connector-custom-research/publish`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-actor-id": "user-security"
    },
    body: JSON.stringify({ signer: "platform-security" })
  });
  assert.equal(publish.status, 200);
  const published = (await publish.json()) as { status: string; signedBy: string };
  assert.equal(published.status, "published");
  assert.equal(published.signedBy, "platform-security");
});

test("rejects duplicate tool ids", async () => {
  const create = async () =>
    fetch(`${baseUrl}/v1/tools`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-actor-id": "user-security"
      },
      body: JSON.stringify({
        toolId: "connector-duplicate-test",
        displayName: "Duplicate Connector",
        connectorType: "ticketing",
        description: "Connector for duplication checks",
        trustTier: "tier-2",
        allowedActions: ["READ"],
        permissionScopes: ["ticket.read"],
        outboundDomains: ["tickets.internal.local"],
        signature: "sig-dup-v1"
      })
    });

  const first = await create();
  assert.equal(first.status, 201);

  const second = await create();
  assert.equal(second.status, 409);
  const body = (await second.json()) as { error: string };
  assert.equal(body.error, "tool_manifest_already_exists");
});
