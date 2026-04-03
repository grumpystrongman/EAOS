#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { resolve } from "node:path";
import { createAppServer } from "../../dist/services/tool-registry/src/index.js";
import { getCompanyProfile } from "./company-profile.mjs";

const profile = getCompanyProfile();
const port = Number(process.env.OPENAEGIS_CONNECTIONS_TOOL_REGISTRY_PORT ?? 4301);
const outputPath = resolve(process.cwd(), "docs", "assets", "demo", "commercial-connections-report.json");
const connectionRefPrefix = (process.env.OPENAEGIS_CONNECTION_REF_PREFIX ?? "vault://grumpyman-distributors/commercial").replace(/\/+$/, "");
const brokerRefPrefix = (process.env.OPENAEGIS_BROKER_REF_PREFIX ?? "broker://grumpyman-distributors/commercial").replace(/\/+$/, "");
const commercialBaseDomain = process.env.OPENAEGIS_COMMERCIAL_BASE_DOMAIN ?? `enterprise.${profile.companyDomain}`;

const targetConnectorTypes = new Set([
  "databricks",
  "fabric",
  "microsoft-fabric",
  "aws",
  "jira",
  "confluence",
  "openai",
  "anthropic",
  "google",
  "azure-openai",
  "airbyte",
  "airflow",
  "trino",
  "superset",
  "metabase",
  "grafana",
  "kafka",
  "nifi",
  "dagster",
  "n8n",
  "power-bi",
  "sharepoint",
  "project",
  "ticketing"
]);

const request = async (path, options = {}) => {
  const headers = {
    "x-actor-id": "seed-commercial-connections",
    "x-tenant-id": profile.tenantId,
    "x-roles": "platform_admin,security_admin",
    ...options.headers
  };
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    ...options,
    headers
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
};

const buildVaultRef = (toolId, key) => `${connectionRefPrefix}/${toolId}/${key}`;
const buildBrokerRef = (toolId, key) => `${brokerRefPrefix}/${toolId}/${key}`;

const resolveAuthInput = (manifest) => {
  const method = Array.isArray(manifest.authMethods) && manifest.authMethods.length > 0
    ? manifest.authMethods[0]
    : "api_key";

  if (method === "service_principal") {
    return {
      method,
      clientId: `spn-${manifest.connectorType}-${profile.tenantId}`,
      tenantId: profile.tenantId,
      principalId: `principal-${manifest.connectorType}-${profile.tenantId}`,
      refs: {
        clientSecretRef: buildVaultRef(manifest.toolId, "client-secret")
      }
    };
  }

  if (method === "key_pair") {
    return {
      method,
      refs: {
        privateKeyRef: buildVaultRef(manifest.toolId, "private-key")
      }
    };
  }

  if (method === "oauth2") {
    return {
      method,
      clientId: `oauth-${manifest.connectorType}-${profile.tenantId}`,
      tenantId: profile.tenantId
    };
  }

  return {
    method: "api_key",
    refs: {
      apiKeyRef: buildVaultRef(manifest.toolId, "api-key")
    }
  };
};

const resolveConfig = (manifest) => {
  const baseUrl = `https://${manifest.connectorType}.${commercialBaseDomain}`;
  const config = {
    baseUrl,
    endpoint: `https://api.${commercialBaseDomain}/${manifest.connectorType}`,
    region: "us-east-1",
    workspaceId: `${manifest.connectorType}-workspace`,
    projectKey: `GM-${manifest.connectorType}`.slice(0, 24),
    model: "production-safe",
    organizationId: profile.tenantId,
    apiVersion: "2026-04-01"
  };
  return config;
};

const authorizeIfNeeded = async (instance, manifest) => {
  if (instance.auth?.method !== "oauth2") {
    return { status: "skipped", details: "auth_method_not_oauth2" };
  }
  const authorizationPayload = {
    authorizationBrokerRef: buildBrokerRef(manifest.toolId, "authorization"),
    tokenBrokerRef: buildBrokerRef(manifest.toolId, "token"),
    refreshTokenBrokerRef: buildBrokerRef(manifest.toolId, "refresh"),
    callbackBrokerRef: buildBrokerRef(manifest.toolId, "callback"),
    codeBrokerRef: buildBrokerRef(manifest.toolId, "code")
  };

  const authorized = await request(`/v1/plugins/instances/${instance.instanceId}/authorize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(authorizationPayload)
  });

  return {
    status: authorized.status === 200 ? "ok" : "failed",
    details: authorized
  };
};

const testInstance = async (instance) => {
  const test = await request(`/v1/plugins/instances/${instance.instanceId}/test`, {
    method: "POST"
  });
  return {
    status: test.status === 200 ? "ok" : "failed",
    details: test
  };
};

const run = async () => {
  const startedAt = new Date().toISOString();
  const server = createAppServer();
  server.listen(port);
  await once(server, "listening");

  const createdInstances = [];
  const processed = [];

  try {
    const manifestsResponse = await request("/v1/tools?status=published");
    if (manifestsResponse.status !== 200 || !Array.isArray(manifestsResponse.body?.manifests)) {
      throw new Error(`unable_to_list_manifests:${manifestsResponse.status}`);
    }

    const existingResponse = await request("/v1/plugins/instances");
    if (existingResponse.status !== 200 || !Array.isArray(existingResponse.body?.instances)) {
      throw new Error(`unable_to_list_instances:${existingResponse.status}`);
    }
    const existingByManifest = new Map(
      existingResponse.body.instances.map((instance) => [instance.manifestToolId, instance])
    );

    const targetManifests = manifestsResponse.body.manifests.filter((manifest) =>
      targetConnectorTypes.has(manifest.connectorType)
    );

    for (const manifest of targetManifests) {
      let instance = existingByManifest.get(manifest.toolId);
      let creationStatus = "existing";

      if (!instance) {
        const createPayload = {
          manifestToolId: manifest.toolId,
          displayName: `${profile.companyName} ${manifest.displayName}`,
          auth: resolveAuthInput(manifest),
          config: resolveConfig(manifest)
        };

        const created = await request("/v1/plugins/instances", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(createPayload)
        });
        if (created.status !== 201) {
          processed.push({
            manifestToolId: manifest.toolId,
            connectorType: manifest.connectorType,
            status: "failed",
            stage: "create",
            details: created
          });
          continue;
        }
        instance = created.body;
        creationStatus = "created";
        createdInstances.push(instance.instanceId);
      }

      const authorization = await authorizeIfNeeded(instance, manifest);
      const test = await testInstance(instance);
      const passed = test.status === "ok";

      processed.push({
        manifestToolId: manifest.toolId,
        connectorType: manifest.connectorType,
        instanceId: instance.instanceId,
        creationStatus,
        authorizationStatus: authorization.status,
        testStatus: test.status,
        status: passed ? "healthy" : "failed",
        authMethod: instance.auth?.method ?? null,
        details: {
          authorization: authorization.details,
          test: test.details
        }
      });
    }
  } finally {
    server.close();
    await once(server, "close");
  }

  const passed = processed.filter((item) => item.status === "healthy").length;
  const failed = processed.length - passed;
  const report = {
    generatedAt: new Date().toISOString(),
    startedAt,
    suite: "seed-commercial-connections",
    company: {
      name: profile.companyName,
      tenantId: profile.tenantId,
      baseDomain: commercialBaseDomain
    },
    summary: {
      targetConnectorCount: processed.length,
      passed,
      failed,
      status: failed === 0 ? "PASS" : "FAIL"
    },
    createdInstances,
    processed
  };

  await mkdir(resolve(process.cwd(), "docs", "assets", "demo"), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (failed > 0) {
    console.error(`COMMERCIAL CONNECTION SEED FAILED -> ${failed} connector(s)`);
    process.exitCode = 1;
  } else {
    console.log(`COMMERCIAL CONNECTION SEED PASSED -> ${outputPath}`);
  }
};

run().catch((error) => {
  console.error("COMMERCIAL CONNECTION SEED FAILED", error);
  process.exitCode = 1;
});
