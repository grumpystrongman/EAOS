#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { resolve } from "node:path";
import { createAppServer } from "../../backend/services/api-gateway/src/index.ts";
import { getCompanyProfile } from "./company-profile.mjs";

const profile = getCompanyProfile();
const port = Number(process.env.OPENAEGIS_ROLE_SMOKE_PORT ?? 3903);
const outputPath = resolve(process.cwd(), "docs", "assets", "demo", "role-smoke-report.json");

const roleOrder = [
  "platformAdmin",
  "securityAdmin",
  "auditor",
  "workflowOperator",
  "approver",
  "analyst"
];

const roleDisplay = {
  platformAdmin: "platform_admin",
  securityAdmin: "security_admin",
  auditor: "auditor",
  workflowOperator: "workflow_operator",
  approver: "approver",
  analyst: "analyst"
};

const request = async (path, options = {}) => {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
};

const loginForRole = async (role) => {
  const attempts = profile.roleEmailFallbacks[role] ?? [];
  const errors = [];
  for (const email of attempts) {
    const login = await request("/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (login.status === 200 && typeof login.body?.accessToken === "string") {
      return { email, accessToken: login.body.accessToken, user: login.body.user };
    }
    errors.push({ email, status: login.status, error: login.body?.error ?? "login_failed" });
  }
  throw new Error(`login_failed_for_role:${role}:${JSON.stringify(errors)}`);
};

const run = async () => {
  process.env.OPENAEGIS_ENABLE_INSECURE_DEMO_AUTH = "true";
  const startedAt = new Date().toISOString();
  const server = createAppServer();
  server.listen(port);
  await once(server, "listening");

  const checks = [];
  const sessions = {};

  const pushCheck = (checkId, passed, details) => {
    checks.push({
      checkId,
      passed,
      details
    });
  };

  try {
    for (const role of roleOrder) {
      const session = await loginForRole(role);
      sessions[role] = session;
      pushCheck(`login_${roleDisplay[role]}`, true, {
        role: roleDisplay[role],
        emailUsed: session.email,
        userId: session.user?.userId ?? "n/a",
        tenantId: session.user?.tenantId ?? "n/a"
      });
    }

    const operatorToken = sessions.workflowOperator.accessToken;
    const approverToken = sessions.approver.accessToken;
    const securityToken = sessions.securityAdmin.accessToken;
    const adminToken = sessions.platformAdmin.accessToken;
    const analystToken = sessions.analyst.accessToken;
    const auditorToken = sessions.auditor.accessToken;

    const simulationRun = await request("/v1/executions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${operatorToken}`
      },
      body: JSON.stringify({
        mode: "simulation",
        workflowId: "wf-discharge-assistant",
        patientId: "patient-1001",
        tenantId: profile.tenantId,
        requestFollowupEmail: true
      })
    });
    pushCheck("workflow_operator_simulation_run", simulationRun.status === 201, {
      status: simulationRun.status,
      executionStatus: simulationRun.body?.status
    });

    const liveRun = await request("/v1/executions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${operatorToken}`
      },
      body: JSON.stringify({
        mode: "live",
        workflowId: "wf-discharge-assistant",
        patientId: "patient-1001",
        tenantId: profile.tenantId,
        requestFollowupEmail: true
      })
    });
    const liveBlocked = liveRun.status === 201 && liveRun.body?.status === "blocked" && typeof liveRun.body?.approvalId === "string";
    pushCheck("workflow_operator_live_run_creates_approval", liveBlocked, {
      status: liveRun.status,
      executionStatus: liveRun.body?.status,
      approvalId: liveRun.body?.approvalId ?? null
    });

    if (!liveBlocked) {
      throw new Error("live_workflow_did_not_block_for_approval");
    }

    const approvalDecision = await request(`/v1/approvals/${liveRun.body.approvalId}/decide`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${approverToken}`
      },
      body: JSON.stringify({ decision: "approve", reason: "Role smoke approval" })
    });
    pushCheck("approver_approves_live_execution", approvalDecision.status === 200, {
      status: approvalDecision.status,
      result: approvalDecision.body?.status ?? "n/a"
    });

    const finalExecution = await request(`/v1/executions/${liveRun.body.executionId}`, {
      headers: { authorization: `Bearer ${operatorToken}` }
    });
    pushCheck("workflow_execution_completed_post_approval", finalExecution.status === 200 && finalExecution.body?.status === "completed", {
      status: finalExecution.status,
      executionStatus: finalExecution.body?.status
    });

    const analystIncidentAccess = await request("/v1/incidents", {
      headers: { authorization: `Bearer ${analystToken}` }
    });
    pushCheck("analyst_incident_access_denied_expected", analystIncidentAccess.status === 403, {
      status: analystIncidentAccess.status,
      error: analystIncidentAccess.body?.error
    });

    const auditorAuditRead = await request("/v1/audit/events", {
      headers: { authorization: `Bearer ${auditorToken}` }
    });
    pushCheck("auditor_reads_audit_events", auditorAuditRead.status === 200 && Array.isArray(auditorAuditRead.body?.events), {
      status: auditorAuditRead.status,
      eventCount: Array.isArray(auditorAuditRead.body?.events) ? auditorAuditRead.body.events.length : 0
    });

    const securityPreview = await request("/v1/policies/profile/preview", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${securityToken}`
      },
      body: JSON.stringify({
        tenantId: profile.tenantId,
        profileName: `${profile.companyName} Safe Baseline`,
        controls: {
          maxToolCallsPerExecution: 8
        }
      })
    });
    pushCheck("security_admin_policy_preview", securityPreview.status === 200, {
      status: securityPreview.status,
      valid: securityPreview.body?.validation?.valid ?? null
    });

    const securitySave = await request("/v1/policies/profile/save", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${securityToken}`
      },
      body: JSON.stringify({
        tenantId: profile.tenantId,
        profileName: `${profile.companyName} Safe Baseline`,
        changeSummary: "Role smoke: reaffirm baseline controls.",
        controls: {
          enforceSecretDeny: true,
          requireZeroRetentionForPhi: true,
          requireApprovalForHighRiskLive: true,
          requireDlpOnOutbound: true,
          restrictExternalProvidersToZeroRetention: true,
          maxToolCallsPerExecution: 8
        }
      })
    });
    pushCheck("security_admin_policy_save", securitySave.status === 200, {
      status: securitySave.status,
      breakGlassUsed: securitySave.body?.breakGlassUsed ?? null
    });

    const adminCommercial = await request("/v1/commercial/readiness", {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    pushCheck("platform_admin_commercial_readiness", adminCommercial.status === 200, {
      status: adminCommercial.status,
      score: adminCommercial.body?.summary?.score ?? null
    });

    const securityIncidents = await request("/v1/incidents", {
      headers: { authorization: `Bearer ${securityToken}` }
    });
    pushCheck("security_admin_incident_read", securityIncidents.status === 200 && Array.isArray(securityIncidents.body?.incidents), {
      status: securityIncidents.status,
      incidentCount: Array.isArray(securityIncidents.body?.incidents) ? securityIncidents.body.incidents.length : 0
    });
  } finally {
    server.close();
    await once(server, "close");
  }

  const passedChecks = checks.filter((check) => check.passed).length;
  const failedChecks = checks.length - passedChecks;
  const report = {
    generatedAt: new Date().toISOString(),
    startedAt,
    suite: "role-smoke-human-operator",
    company: {
      name: profile.companyName,
      tenantId: profile.tenantId
    },
    roleMapping: Object.fromEntries(
      Object.entries(sessions).map(([role, session]) => [
        roleDisplay[role],
        {
          emailUsed: session.email,
          userId: session.user?.userId ?? null,
          roles: session.user?.roles ?? []
        }
      ])
    ),
    checks,
    summary: {
      totalChecks: checks.length,
      passedChecks,
      failedChecks,
      status: failedChecks === 0 ? "PASS" : "FAIL"
    }
  };

  await mkdir(resolve(process.cwd(), "docs", "assets", "demo"), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (failedChecks > 0) {
    console.error(JSON.stringify(report.summary, null, 2));
    process.exitCode = 1;
  } else {
    console.log(`ROLE SMOKE PASSED -> ${outputPath}`);
  }
};

run().catch((error) => {
  console.error("ROLE SMOKE FAILED", error);
  process.exitCode = 1;
});

