#!/usr/bin/env node
import { once } from "node:events";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createAppServer as createGatewayServer } from "../../dist/services/api-gateway/src/index.js";
import { createAppServer as createToolRegistryServer } from "../../dist/services/tool-registry/src/index.js";
import { getCompanyProfile } from "./company-profile.mjs";

const profile = getCompanyProfile();

const ports = {
  gateway: Number(process.env.OPENAEGIS_PROVISION_GATEWAY_PORT ?? 4310),
  toolRegistry: Number(process.env.OPENAEGIS_PROVISION_TOOL_REGISTRY_PORT ?? 4311)
};

const baseUrls = {
  gateway: `http://127.0.0.1:${ports.gateway}`,
  toolRegistry: `http://127.0.0.1:${ports.toolRegistry}`
};

const fromEnv = (key, fallback) => {
  const value = process.env[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
};

const actorHeaders = {
  "x-actor-id": "user-admin",
  "x-tenant-id": profile.tenantId,
  "x-roles": "platform_admin,security_admin"
};

const toolRegistryCall = async (path, method = "GET", options = {}) => {
  const response = await fetch(`${baseUrls.toolRegistry}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...actorHeaders,
      ...(options.headers ?? {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
};

const gatewayCall = async (path, method = "GET", options = {}) => {
  const response = await fetch(`${baseUrls.gateway}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
};

const connectorPlan = () => [
  {
    manifestToolId: "connector-databricks-workspace",
    displayName: `${profile.companyName} Databricks`,
    auth: {
      method: "api_key",
      refs: {
        apiKeyRef: fromEnv("OPENAEGIS_DATABRICKS_API_KEY_REF", "vault://grumpyman/databricks/api-key")
      }
    },
    config: {
      baseUrl: fromEnv("OPENAEGIS_DATABRICKS_BASE_URL", "https://adb-4528719301248981.11.azuredatabricks.net"),
      workspaceId: fromEnv("OPENAEGIS_DATABRICKS_WORKSPACE_ID", "gm-dist-lakehouse")
    }
  },
  {
    manifestToolId: "connector-fabric-automation",
    displayName: `${profile.companyName} Fabric`,
    auth: {
      method: "service_principal",
      clientId: fromEnv("OPENAEGIS_FABRIC_CLIENT_ID", "6d9140b1-0c93-4454-ad53-8c6cb8cb57a8"),
      tenantId: fromEnv("OPENAEGIS_FABRIC_TENANT_ID", "d5304b89-e654-4f37-9220-0b7be40fbc77"),
      refs: {
        clientSecretRef: fromEnv("OPENAEGIS_FABRIC_CLIENT_SECRET_REF", "vault://grumpyman/fabric/client-secret")
      }
    },
    config: {
      baseUrl: fromEnv("OPENAEGIS_FABRIC_BASE_URL", "https://api.fabric.microsoft.com"),
      workspaceId: fromEnv("OPENAEGIS_FABRIC_WORKSPACE_ID", "grumpyman-fabric-workspace")
    }
  },
  {
    manifestToolId: "connector-aws-infrastructure",
    displayName: `${profile.companyName} AWS`,
    auth: {
      method: "service_principal",
      principalId: fromEnv(
        "OPENAEGIS_AWS_ROLE_ARN",
        "arn:aws:iam::281149750626:role/OpenAegisRuntimeRole"
      ),
      refs: {
        clientSecretRef: fromEnv("OPENAEGIS_AWS_SECRET_REF", "vault://grumpyman/aws/runtime-secret")
      }
    },
    config: {
      region: fromEnv("OPENAEGIS_AWS_REGION", "us-east-1")
    }
  },
  {
    manifestToolId: "connector-jira-workflow",
    displayName: `${profile.companyName} Jira`,
    auth: {
      method: "oauth2"
    },
    brokerRefs: {
      authorizationBrokerRef: fromEnv("OPENAEGIS_JIRA_AUTH_BROKER_REF", "broker://grumpyman/jira/auth"),
      tokenBrokerRef: fromEnv("OPENAEGIS_JIRA_TOKEN_BROKER_REF", "broker://grumpyman/jira/token")
    },
    config: {
      baseUrl: fromEnv("OPENAEGIS_JIRA_BASE_URL", "https://grumpyman.atlassian.net"),
      projectKey: fromEnv("OPENAEGIS_JIRA_PROJECT_KEY", "OPS")
    }
  },
  {
    manifestToolId: "connector-confluence-knowledge",
    displayName: `${profile.companyName} Confluence`,
    auth: {
      method: "oauth2"
    },
    brokerRefs: {
      authorizationBrokerRef: fromEnv("OPENAEGIS_CONFLUENCE_AUTH_BROKER_REF", "broker://grumpyman/confluence/auth"),
      tokenBrokerRef: fromEnv("OPENAEGIS_CONFLUENCE_TOKEN_BROKER_REF", "broker://grumpyman/confluence/token")
    },
    config: {
      baseUrl: fromEnv("OPENAEGIS_CONFLUENCE_BASE_URL", "https://grumpyman.atlassian.net/wiki")
    }
  },
  {
    manifestToolId: "connector-linear-project",
    displayName: `${profile.companyName} Linear`,
    auth: {
      method: "api_key",
      refs: {
        apiKeyRef: fromEnv("OPENAEGIS_LINEAR_API_KEY_REF", "vault://grumpyman/linear/api-key")
      }
    },
    config: {
      baseUrl: "https://api.linear.app"
    }
  },
  {
    manifestToolId: "connector-openai-responses",
    displayName: `${profile.companyName} OpenAI`,
    auth: {
      method: "api_key",
      refs: {
        apiKeyRef: fromEnv("OPENAEGIS_OPENAI_API_KEY_REF", "vault://grumpyman/openai/api-key")
      }
    },
    config: {
      baseUrl: "https://api.openai.com",
      model: fromEnv("OPENAEGIS_OPENAI_MODEL", "gpt-5.4")
    }
  },
  {
    manifestToolId: "connector-anthropic-claude",
    displayName: `${profile.companyName} Anthropic`,
    auth: {
      method: "api_key",
      refs: {
        apiKeyRef: fromEnv("OPENAEGIS_ANTHROPIC_API_KEY_REF", "vault://grumpyman/anthropic/api-key")
      }
    },
    config: {
      baseUrl: "https://api.anthropic.com",
      model: fromEnv("OPENAEGIS_ANTHROPIC_MODEL", "claude-3-7-sonnet")
    }
  },
  {
    manifestToolId: "connector-google-gemini",
    displayName: `${profile.companyName} Gemini`,
    auth: {
      method: "service_principal",
      clientId: fromEnv("OPENAEGIS_GOOGLE_CLIENT_ID", "gm-openaegis-service"),
      refs: {
        clientSecretRef: fromEnv("OPENAEGIS_GOOGLE_SECRET_REF", "vault://grumpyman/google/client-secret")
      }
    },
    config: {
      baseUrl: "https://generativelanguage.googleapis.com",
      model: fromEnv("OPENAEGIS_GOOGLE_MODEL", "gemini-2.5-pro")
    }
  },
  {
    manifestToolId: "connector-azure-openai",
    displayName: `${profile.companyName} Azure OpenAI`,
    auth: {
      method: "api_key",
      refs: {
        apiKeyRef: fromEnv("OPENAEGIS_AZURE_OPENAI_API_KEY_REF", "vault://grumpyman/azure-openai/api-key")
      }
    },
    config: {
      baseUrl: fromEnv("OPENAEGIS_AZURE_OPENAI_ENDPOINT", "https://grumpyman-openai.openai.azure.com"),
      apiVersion: fromEnv("OPENAEGIS_AZURE_OPENAI_API_VERSION", "2025-03-01-preview"),
      model: fromEnv("OPENAEGIS_AZURE_OPENAI_MODEL", "gpt-4.1")
    }
  }
];

const waitForHttp = async (url, timeoutMs = 60_000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      // service booting
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`timeout_waiting_for_http:${url}`);
};

export const runGrumpyManProvisioning = async () => {
  process.env.OPENAEGIS_ENABLE_INSECURE_DEMO_AUTH = "true";
  await rm(".volumes/pilot-state.json", { force: true });
  await rm(".volumes/tool-registry-state.json", { force: true });

  const servers = {
    gateway: createGatewayServer(),
    toolRegistry: createToolRegistryServer()
  };
  servers.gateway.listen(ports.gateway);
  servers.toolRegistry.listen(ports.toolRegistry);
  await Promise.all([once(servers.gateway, "listening"), once(servers.toolRegistry, "listening")]);

  const report = {
    generatedAt: new Date().toISOString(),
    company: profile.companyName,
    tenantId: profile.tenantId,
    endpoints: baseUrls,
    auth: {
      clinicianEmail: profile.clinicianEmail,
      securityEmail: profile.securityEmail,
      adminEmail: profile.adminEmail
    },
    checks: [],
    provisionedConnections: [],
    summary: {
      totalConnections: 0,
      healthyConnections: 0,
      failedConnections: 0,
      status: "FAIL"
    }
  };

  try {
    await waitForHttp(`${baseUrls.gateway}/healthz`);
    await waitForHttp(`${baseUrls.toolRegistry}/healthz`);

    const login = await gatewayCall("/v1/auth/login", "POST", {
      body: { email: profile.adminEmail }
    });
    const fallbackLogin = login.status === 200
      ? login
      : await gatewayCall("/v1/auth/login", "POST", { body: { email: profile.securityEmail } });
    report.checks.push({
      checkId: "gateway_admin_login",
      passed: fallbackLogin.status === 200,
      details: {
        attempted: [profile.adminEmail, profile.securityEmail],
        status: fallbackLogin.status
      }
    });

    const catalog = await toolRegistryCall("/v1/tools?status=published");
    const manifestIds = new Set(
      Array.isArray(catalog.payload.manifests)
        ? catalog.payload.manifests.map((manifest) => manifest.toolId)
        : []
    );
    report.checks.push({
      checkId: "tool_registry_catalog_loaded",
      passed: catalog.status === 200 && manifestIds.size > 0,
      details: { status: catalog.status, manifestCount: manifestIds.size }
    });

    for (const plan of connectorPlan()) {
      if (!manifestIds.has(plan.manifestToolId)) {
        report.provisionedConnections.push({
          manifestToolId: plan.manifestToolId,
          displayName: plan.displayName,
          status: "missing_manifest",
          details: { error: "manifest_not_found" }
        });
        continue;
      }

      const created = await toolRegistryCall("/v1/plugins/instances", "POST", {
        body: {
          manifestToolId: plan.manifestToolId,
          displayName: plan.displayName,
          auth: plan.auth,
          ...(plan.config ? { config: plan.config } : {})
        }
      });

      if (created.status !== 201 || typeof created.payload.instanceId !== "string") {
        report.provisionedConnections.push({
          manifestToolId: plan.manifestToolId,
          displayName: plan.displayName,
          status: "create_failed",
          details: { status: created.status, payload: created.payload }
        });
        continue;
      }

      let authorization = { status: null, payload: {} };
      if (plan.auth.method === "oauth2") {
        authorization = await toolRegistryCall(`/v1/plugins/instances/${created.payload.instanceId}/authorize`, "POST", {
          body: plan.brokerRefs ?? {
            authorizationBrokerRef: "broker://grumpyman/default/auth",
            tokenBrokerRef: "broker://grumpyman/default/token"
          }
        });
      }

      const tested = await toolRegistryCall(`/v1/plugins/instances/${created.payload.instanceId}/test`, "POST");
      const healthy = tested.status === 200 && tested.payload.status === "healthy";
      report.provisionedConnections.push({
        manifestToolId: plan.manifestToolId,
        displayName: plan.displayName,
        instanceId: created.payload.instanceId,
        authMethod: plan.auth.method,
        status: healthy ? "healthy" : "failed",
        details: {
          createStatus: created.status,
          authorizeStatus: authorization.status,
          testStatus: tested.status,
          testMessage: tested.payload.lastTestMessage ?? tested.payload.error ?? null
        }
      });
    }

    report.summary.totalConnections = report.provisionedConnections.length;
    report.summary.healthyConnections = report.provisionedConnections.filter((item) => item.status === "healthy").length;
    report.summary.failedConnections = report.summary.totalConnections - report.summary.healthyConnections;
    report.summary.status = report.summary.failedConnections === 0 ? "PASS" : "FAIL";
  } finally {
    servers.gateway.close();
    servers.toolRegistry.close();
    await Promise.all([once(servers.gateway, "close"), once(servers.toolRegistry, "close")]);
  }

  await mkdir("docs/assets/demo", { recursive: true });
  await writeFile("docs/assets/demo/grumpyman-provisioning-report.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runGrumpyManProvisioning()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (report.summary.status !== "PASS") process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
