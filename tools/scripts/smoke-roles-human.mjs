#!/usr/bin/env node
import { once } from "node:events";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createAppServer as createGatewayServer } from "../../backend/services/api-gateway/src/index.ts";
import { getCompanyProfile } from "./company-profile.mjs";

const profile = getCompanyProfile();
const port = Number(process.env.OPENAEGIS_ROLE_SMOKE_PORT ?? 4320);
const baseUrl = `http://127.0.0.1:${port}`;

const call = async (path, method = "GET", options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
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

const pass = (role, action, condition, details) => ({
  role,
  action,
  passed: Boolean(condition),
  details
});

export const runRoleSmoke = async () => {
  process.env.OPENAEGIS_ENABLE_INSECURE_DEMO_AUTH = "true";
  await rm(".volumes/pilot-state.json", { force: true });
  const gateway = createGatewayServer();
  gateway.listen(port);
  await once(gateway, "listening");

  const report = {
    generatedAt: new Date().toISOString(),
    company: profile.companyName,
    tenantId: profile.tenantId,
    users: {
      clinician: profile.clinicianEmail,
      security: profile.securityEmail,
      admin: profile.adminEmail
    },
    checks: [],
    summary: {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      status: "FAIL"
    }
  };

  try {
    const clinicianLogin = await call("/v1/auth/login", "POST", {
      body: { email: profile.clinicianEmail }
    });
    const securityLogin = await call("/v1/auth/login", "POST", {
      body: { email: profile.securityEmail }
    });
    const adminLogin = await call("/v1/auth/login", "POST", {
      body: { email: profile.adminEmail }
    });

    report.checks.push(
      pass(
        "platform_admin",
        "admin_login_available",
        adminLogin.status === 200,
        { status: adminLogin.status, userId: adminLogin.payload.user?.userId ?? null }
      )
    );

    const clinicianToken = clinicianLogin.payload.accessToken;
    const securityToken = securityLogin.payload.accessToken;
    const adminToken = adminLogin.status === 200 ? adminLogin.payload.accessToken : securityToken;

    const simulation = await call("/v1/executions", "POST", {
      headers: { authorization: `Bearer ${clinicianToken}` },
      body: {
        tenantId: profile.tenantId,
        mode: "simulation",
        workflowId: profile.workflowId,
        patientId: profile.patientId,
        requestFollowupEmail: true
      }
    });
    report.checks.push(
      pass(
        "workflow_operator",
        "run_simulation_workflow",
        simulation.status === 201 && typeof simulation.payload.executionId === "string",
        { status: simulation.status, executionId: simulation.payload.executionId ?? null }
      )
    );

    report.checks.push(
      pass(
        "analyst",
        "view_dashboard_data_path",
        clinicianLogin.status === 200 && Array.isArray(clinicianLogin.payload.user?.roles),
        { roles: clinicianLogin.payload.user?.roles ?? [] }
      )
    );

    const live = await call("/v1/executions", "POST", {
      headers: { authorization: `Bearer ${clinicianToken}` },
      body: {
        tenantId: profile.tenantId,
        mode: "live",
        workflowId: profile.workflowId,
        patientId: profile.patientId,
        requestFollowupEmail: true
      }
    });

    report.checks.push(
      pass(
        "workflow_operator",
        "live_workflow_hits_approval_gate",
        live.status === 201 && live.payload.status === "blocked" && typeof live.payload.approvalId === "string",
        { status: live.status, workflowStatus: live.payload.status, approvalId: live.payload.approvalId ?? null }
      )
    );

    const approvalDeniedForClinician = await call(`/v1/approvals/${live.payload.approvalId}/decide`, "POST", {
      headers: { authorization: `Bearer ${clinicianToken}` },
      body: { decision: "approve", reason: "self-approval check" }
    });
    report.checks.push(
      pass(
        "approver",
        "non_approver_cannot_decide",
        approvalDeniedForClinician.status === 403,
        { status: approvalDeniedForClinician.status, error: approvalDeniedForClinician.payload.error ?? null }
      )
    );

    const approvalDecision = await call(`/v1/approvals/${live.payload.approvalId}/decide`, "POST", {
      headers: { authorization: `Bearer ${securityToken}` },
      body: { decision: "approve", reason: "role smoke approval" }
    });
    report.checks.push(
      pass(
        "approver",
        "approve_pending_live_workflow",
        approvalDecision.status === 200 && approvalDecision.payload.status === "approved",
        { status: approvalDecision.status, approvalStatus: approvalDecision.payload.status ?? null }
      )
    );

    const policyRead = await call("/v1/policies/profile", "GET", {
      headers: { authorization: `Bearer ${securityToken}` }
    });
    report.checks.push(
      pass(
        "security_admin",
        "read_policy_profile",
        policyRead.status === 200 && policyRead.payload.profile?.tenantId === profile.tenantId,
        { status: policyRead.status, tenantId: policyRead.payload.profile?.tenantId ?? null }
      )
    );

    const auditRead = await call("/v1/audit/events", "GET", {
      headers: { authorization: `Bearer ${securityToken}` }
    });
    report.checks.push(
      pass(
        "auditor",
        "read_audit_events",
        auditRead.status === 200 && Array.isArray(auditRead.payload.events),
        { status: auditRead.status, eventCount: Array.isArray(auditRead.payload.events) ? auditRead.payload.events.length : 0 }
      )
    );

    const adminCommercial = await call("/v1/commercial/readiness", "GET", {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    report.checks.push(
      pass(
        "platform_admin",
        "read_commercial_readiness",
        adminCommercial.status === 200 && typeof adminCommercial.payload.summary?.score === "number",
        { status: adminCommercial.status, score: adminCommercial.payload.summary?.score ?? null }
      )
    );

    const adminIncident = await call("/v1/incidents", "GET", {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    report.checks.push(
      pass(
        "platform_admin",
        "inspect_incidents",
        adminIncident.status === 200 && Array.isArray(adminIncident.payload.incidents),
        { status: adminIncident.status, incidentCount: Array.isArray(adminIncident.payload.incidents) ? adminIncident.payload.incidents.length : 0 }
      )
    );
  } finally {
    gateway.close();
    await once(gateway, "close");
  }

  report.summary.totalChecks = report.checks.length;
  report.summary.passedChecks = report.checks.filter((check) => check.passed).length;
  report.summary.failedChecks = report.summary.totalChecks - report.summary.passedChecks;
  report.summary.status = report.summary.failedChecks === 0 ? "PASS" : "FAIL";

  await mkdir("docs/assets/demo", { recursive: true });
  await writeFile("docs/assets/demo/grumpyman-role-smoke-report.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRoleSmoke()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (report.summary.status !== "PASS") process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

