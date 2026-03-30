#!/usr/bin/env node
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createAppServer as createGatewayServer } from "../../dist/services/api-gateway/src/index.js";
import { createAppServer as createAuthServer } from "../../dist/services/auth-service/src/index.js";

const ports = {
  gateway: Number(process.env.OPENAEGIS_SECURITY_GATEWAY_PORT ?? 3970),
  auth: Number(process.env.OPENAEGIS_SECURITY_AUTH_PORT ?? 3971)
};

const baseUrls = {
  gateway: `http://127.0.0.1:${ports.gateway}`,
  auth: `http://127.0.0.1:${ports.auth}`
};

const call = async (baseUrl, path, method = "GET", options = {}) => {
  const headers = { "content-type": "application/json", ...(options.headers ?? {}) };
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  return {
    status: response.status,
    payload
  };
};

const callTimed = async (baseUrl, path, method = "GET", options = {}) => {
  const startedAt = Date.now();
  const result = await call(baseUrl, path, method, options);
  return {
    ...result,
    elapsedMs: Date.now() - startedAt
  };
};

const normalizeError = (payload) => (typeof payload?.error === "string" ? payload.error : "none");

export const runSecurityRegression = async () => {
  const envBackup = {
    OPENAEGIS_REQUIRE_INTROSPECTION: process.env.OPENAEGIS_REQUIRE_INTROSPECTION,
    OPENAEGIS_AUTH_INTROSPECTION_URL: process.env.OPENAEGIS_AUTH_INTROSPECTION_URL,
    OPENAEGIS_AUTH_INTROSPECTOR_ACTOR_ID: process.env.OPENAEGIS_AUTH_INTROSPECTOR_ACTOR_ID,
    OPENAEGIS_AUTH_INTROSPECTOR_TENANT_ID: process.env.OPENAEGIS_AUTH_INTROSPECTOR_TENANT_ID,
    OPENAEGIS_AUTH_ISSUER: process.env.OPENAEGIS_AUTH_ISSUER
  };

  process.env.OPENAEGIS_REQUIRE_INTROSPECTION = "true";
  process.env.OPENAEGIS_AUTH_INTROSPECTION_URL = `${baseUrls.auth}/v1/auth/introspect`;
  process.env.OPENAEGIS_AUTH_INTROSPECTOR_ACTOR_ID = "service-gateway";
  process.env.OPENAEGIS_AUTH_INTROSPECTOR_TENANT_ID = "tenant-platform";
  process.env.OPENAEGIS_AUTH_ISSUER = baseUrls.auth;

  const servers = {
    auth: createAuthServer(),
    gateway: createGatewayServer()
  };

  servers.auth.listen(ports.auth);
  servers.gateway.listen(ports.gateway);
  await Promise.all([once(servers.auth, "listening"), once(servers.gateway, "listening")]);

  const checks = [];

  try {
    const demoTokenDenied = await callTimed(baseUrls.gateway, "/v1/executions", "POST", {
      headers: { authorization: "Bearer demo-token-user-security" },
      body: {
        tenantId: "tenant-starlight-health",
        workflowId: "wf-discharge-assistant",
        patientId: "patient-1001",
        mode: "simulation"
      }
    });
    checks.push({
      checkId: "demo_token_denied_when_introspection_required",
      passed: demoTokenDenied.status === 401 && normalizeError(demoTokenDenied.payload) === "missing_or_invalid_auth_token",
      details: {
        status: demoTokenDenied.status,
        error: normalizeError(demoTokenDenied.payload),
        latencyMs: demoTokenDenied.elapsedMs
      }
    });

    const clinicianToken = await callTimed(baseUrls.auth, "/v1/auth/token", "POST", {
      body: { email: "clinician@starlighthealth.org" }
    });
    const securityToken = await callTimed(baseUrls.auth, "/v1/auth/token", "POST", {
      body: { email: "security@starlighthealth.org" }
    });

    checks.push({
      checkId: "auth_service_issues_introspectable_tokens",
      passed: clinicianToken.status === 200 && securityToken.status === 200,
      details: {
        clinicianStatus: clinicianToken.status,
        securityStatus: securityToken.status,
        clinicianSubject: clinicianToken.payload.subject,
        securitySubject: securityToken.payload.subject
      }
    });

    const clinicianAccessToken =
      typeof clinicianToken.payload.accessToken === "string" ? clinicianToken.payload.accessToken : "";
    const securityAccessToken = typeof securityToken.payload.accessToken === "string" ? securityToken.payload.accessToken : "";

    const sameTenantExecution = await callTimed(baseUrls.gateway, "/v1/executions", "POST", {
      headers: { authorization: `Bearer ${clinicianAccessToken}` },
      body: {
        tenantId: "tenant-starlight-health",
        workflowId: "wf-discharge-assistant",
        patientId: "patient-1001",
        mode: "simulation"
      }
    });
    checks.push({
      checkId: "introspected_token_allows_same_tenant_execution",
      passed: sameTenantExecution.status === 201 && typeof sameTenantExecution.payload.executionId === "string",
      details: {
        status: sameTenantExecution.status,
        executionId: sameTenantExecution.payload.executionId,
        latencyMs: sameTenantExecution.elapsedMs
      }
    });

    const crossTenantExecution = await callTimed(baseUrls.gateway, "/v1/executions", "POST", {
      headers: { authorization: `Bearer ${clinicianAccessToken}` },
      body: {
        tenantId: "tenant-other-health",
        workflowId: "wf-discharge-assistant",
        patientId: "patient-2001",
        mode: "simulation"
      }
    });
    checks.push({
      checkId: "cross_tenant_write_blocked",
      passed: crossTenantExecution.status === 403 && normalizeError(crossTenantExecution.payload) === "tenant_scope_mismatch",
      details: {
        status: crossTenantExecution.status,
        error: normalizeError(crossTenantExecution.payload),
        latencyMs: crossTenantExecution.elapsedMs
      }
    });

    const policyWithoutBreakGlass = await callTimed(baseUrls.gateway, "/v1/policies/profile/save", "POST", {
      headers: { authorization: `Bearer ${securityAccessToken}` },
      body: {
        tenantId: "tenant-starlight-health",
        profileName: "Security regression draft",
        changeSummary: "Disable secret deny without break-glass",
        controls: {
          enforceSecretDeny: false
        }
      }
    });

    const policyWithBreakGlass = await callTimed(baseUrls.gateway, "/v1/policies/profile/save", "POST", {
      headers: { authorization: `Bearer ${securityAccessToken}` },
      body: {
        tenantId: "tenant-starlight-health",
        profileName: "Security regression draft",
        changeSummary: "Controlled exception for regression drill",
        controls: {
          enforceSecretDeny: false
        },
        breakGlass: {
          ticketId: "SEC-REGRESSION-001",
          justification: "Regression test with temporary exception and rollback plan.",
          approverIds: ["security-lead-1", "compliance-lead-2"]
        }
      }
    });

    checks.push({
      checkId: "break_glass_required_for_blocking_policy_change",
      passed:
        policyWithoutBreakGlass.status === 422 &&
        normalizeError(policyWithoutBreakGlass.payload) === "break_glass_required_for_blocking_policy_changes" &&
        policyWithBreakGlass.status === 200 &&
        policyWithBreakGlass.payload.breakGlassUsed === true,
      details: {
        deniedStatus: policyWithoutBreakGlass.status,
        deniedError: normalizeError(policyWithoutBreakGlass.payload),
        approvedStatus: policyWithBreakGlass.status,
        breakGlassUsed: policyWithBreakGlass.payload.breakGlassUsed === true
      }
    });

    const revokeResponse = await callTimed(baseUrls.auth, "/v1/auth/revoke", "POST", {
      headers: {
        "x-actor-id": "service-gateway",
        "x-tenant-id": "tenant-platform"
      },
      body: { token: clinicianAccessToken }
    });
    const postRevokeExecution = await callTimed(baseUrls.gateway, "/v1/executions", "POST", {
      headers: { authorization: `Bearer ${clinicianAccessToken}` },
      body: {
        tenantId: "tenant-starlight-health",
        workflowId: "wf-discharge-assistant",
        patientId: "patient-3001",
        mode: "simulation"
      }
    });
    checks.push({
      checkId: "revoked_token_denied_via_introspection",
      passed:
        revokeResponse.status === 200 &&
        revokeResponse.payload.revoked === true &&
        postRevokeExecution.status === 401 &&
        normalizeError(postRevokeExecution.payload) === "missing_or_invalid_auth_token",
      details: {
        revokeStatus: revokeResponse.status,
        revoked: revokeResponse.payload.revoked === true,
        gatewayStatus: postRevokeExecution.status,
        gatewayError: normalizeError(postRevokeExecution.payload)
      }
    });
  } finally {
    servers.auth.close();
    servers.gateway.close();
    await Promise.all([once(servers.auth, "close"), once(servers.gateway, "close")]);

    for (const [key, value] of Object.entries(envBackup)) {
      if (typeof value === "string") {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
  }

  const passedChecks = checks.filter((check) => check.passed).length;
  const scorePercent = Number(((passedChecks / Math.max(1, checks.length)) * 100).toFixed(2));
  const report = {
    generatedAt: new Date().toISOString(),
    suite: "security-regression",
    endpoints: baseUrls,
    checks,
    summary: {
      totalChecks: checks.length,
      passedChecks,
      failedChecks: checks.length - passedChecks,
      scorePercent,
      status: checks.every((check) => check.passed) ? "PASS" : "FAIL"
    }
  };

  await mkdir("docs/assets/demo", { recursive: true });
  await writeFile("docs/assets/demo/security-regression-report.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSecurityRegression()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (report.summary.status !== "PASS") process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
