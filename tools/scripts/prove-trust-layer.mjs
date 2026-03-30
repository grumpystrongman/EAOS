#!/usr/bin/env node
import { once } from "node:events";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createAppServer as createGatewayServer } from "../../dist/services/api-gateway/src/index.js";
import { createAppServer as createToolRegistryServer } from "../../dist/services/tool-registry/src/index.js";
import { createAppServer as createToolExecutionServer } from "../../dist/services/tool-execution-service/src/index.js";
import { createAppServer as createKillSwitchServer } from "../../dist/services/kill-switch-service/src/index.js";

const ports = {
  gateway: Number(process.env.OPENAEGIS_TRUST_GATEWAY_PORT ?? 3960),
  toolRegistry: Number(process.env.OPENAEGIS_TRUST_TOOL_REGISTRY_PORT ?? 3961),
  toolExecution: Number(process.env.OPENAEGIS_TRUST_TOOL_EXECUTION_PORT ?? 3962),
  killSwitch: Number(process.env.OPENAEGIS_TRUST_KILL_SWITCH_PORT ?? 3963)
};

const baseUrls = {
  gateway: `http://127.0.0.1:${ports.gateway}`,
  toolRegistry: `http://127.0.0.1:${ports.toolRegistry}`,
  toolExecution: `http://127.0.0.1:${ports.toolExecution}`,
  killSwitch: `http://127.0.0.1:${ports.killSwitch}`
};

const baselineControls = {
  enforceSecretDeny: true,
  requireZeroRetentionForPhi: true,
  requireApprovalForHighRiskLive: true,
  requireDlpOnOutbound: true,
  restrictExternalProvidersToZeroRetention: true,
  maxToolCallsPerExecution: 8
};

const call = async (baseUrl, path, method = "GET", options = {}) => {
  const headers = { "content-type": "application/json", ...(options.headers ?? {}) };
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
};

const makeExample = (input) => ({
  exampleId: input.exampleId,
  title: input.title,
  persona: input.persona,
  domain: input.domain,
  problemSolved: input.problemSolved,
  trustControlsProven: input.trustControlsProven,
  steps: input.steps,
  passed: Boolean(input.passed),
  summary: input.summary
});

const runHealthcareDischargeExample = async (tokens) => {
  const steps = [];
  const liveExecution = await call(baseUrls.gateway, "/v1/executions", "POST", {
    headers: { authorization: `Bearer ${tokens.clinician}` },
    body: {
      mode: "live",
      workflowId: "wf-discharge-assistant",
      patientId: "patient-1001",
      requestFollowupEmail: true,
      classification: "EPHI",
      zeroRetentionRequested: true
    }
  });

  steps.push({
    step: "start_live_execution",
    expected: "blocked with approval requirement",
    status: liveExecution.status,
    data: {
      executionId: liveExecution.payload.executionId,
      executionStatus: liveExecution.payload.status,
      approvalId: liveExecution.payload.approvalId
    }
  });

  const decision = await call(baseUrls.gateway, `/v1/approvals/${liveExecution.payload.approvalId}/decide`, "POST", {
    headers: { authorization: `Bearer ${tokens.security}` },
    body: { decision: "approve", reason: "Trust proof: discharge criteria validated" }
  });

  steps.push({
    step: "approve_high_risk_action",
    expected: "approval decision accepted",
    status: decision.status,
    data: { approvalStatus: decision.payload.status }
  });

  const executionAfter = await call(
    baseUrls.gateway,
    `/v1/executions/${liveExecution.payload.executionId}`,
    "GET",
    { headers: { authorization: `Bearer ${tokens.clinician}` } }
  );
  const graph = await call(baseUrls.gateway, `/v1/executions/${liveExecution.payload.executionId}/graph`, "GET", {
    headers: { authorization: `Bearer ${tokens.clinician}` }
  });
  const audit = await call(baseUrls.gateway, "/v1/audit/events", "GET", {
    headers: { authorization: `Bearer ${tokens.clinician}` }
  });

  const graphStages = graph.payload.graphExecution?.steps?.map((step) => step.stage) ?? [];
  const passed =
    liveExecution.status === 201 &&
    liveExecution.payload.status === "blocked" &&
    typeof liveExecution.payload.approvalId === "string" &&
    decision.status === 200 &&
    decision.payload.status === "approved" &&
    executionAfter.status === 200 &&
    executionAfter.payload.status === "completed" &&
    JSON.stringify(graphStages) === JSON.stringify(["planner", "executor", "reviewer"]) &&
    audit.status === 200 &&
    Array.isArray(audit.payload.events) &&
    audit.payload.events.some((event) => event.action === "execution_completed");

  steps.push({
    step: "verify_execution_and_evidence",
    expected: "completed execution with deterministic graph and audit evidence",
    status: executionAfter.status,
    data: {
      executionStatus: executionAfter.payload.status,
      graphStages,
      evidenceId: executionAfter.payload.evidenceId,
      auditEvents: audit.payload.events?.length ?? 0
    }
  });

  return makeExample({
    exampleId: "healthcare-discharge-orchestration",
    title: "Hospital Discharge Assistant",
    persona: "Care coordinator and clinical security approver",
    domain: "Healthcare",
    problemSolved: "Automates discharge planning without bypassing human approval or PHI controls.",
    trustControlsProven: [
      "Policy gate for high-risk live actions",
      "Human approval enforcement",
      "Deterministic graph checkpointing",
      "Audit/evidence capture"
    ],
    steps,
    passed,
    summary: passed
      ? "High-risk clinical flow was safely blocked, approved, completed, and fully auditable."
      : "Healthcare trust controls did not fully validate."
  });
};

const runFinanceOpsExample = async (tokens) => {
  const steps = [];
  const registry = await call(baseUrls.toolRegistry, "/v1/tools?status=published");
  steps.push({
    step: "discover_finance_connectors",
    expected: "registry exposes enterprise analytics connectors",
    status: registry.status,
    data: {
      hasFabric: registry.payload.manifests?.some((manifest) => manifest.toolId === "connector-ms-fabric-read") ?? false,
      hasPowerBi: registry.payload.manifests?.some((manifest) => manifest.toolId === "connector-powerbi-export") ?? false,
      publishedCount: registry.payload.manifests?.length ?? 0
    }
  });

  const blockedEmailExecution = await call(baseUrls.toolExecution, "/v1/tool-calls", "POST", {
    headers: {
      "x-actor-id": "user-clinician",
      "x-tenant-id": "tenant-starlight-health"
    },
    body: {
      toolId: "connector-email-notify",
      action: "EXECUTE",
      mode: "execute",
      requestedNetworkProfile: "outbound-approved",
      stepBudgetRemaining: 2,
      requiresApproval: true,
      approvalGranted: false,
      parameters: {
        quarter: "2026-Q1",
        report: "finance-close-exception-summary"
      }
    }
  });

  steps.push({
    step: "block_unapproved_finance_export",
    expected: "runtime guard blocks outbound execution without approval",
    status: blockedEmailExecution.status,
    data: {
      guardReason: blockedEmailExecution.payload.guardReason,
      callStatus: blockedEmailExecution.payload.status
    }
  });

  const idemHeaders = {
    "x-actor-id": "user-admin",
    "x-tenant-id": "tenant-starlight-health",
    "idempotency-key": "trust-finance-close-001"
  };
  const idemBody = {
    toolId: "connector-linear-project",
    action: "EXECUTE",
    mode: "simulate",
    requestedNetworkProfile: "project-ops",
    stepBudgetRemaining: 3,
    parameters: {
      project: "Revenue Cycle",
      title: "Close variance review",
      owner: "Finance Ops"
    }
  };
  const firstCall = await call(baseUrls.toolExecution, "/v1/tool-calls", "POST", {
    headers: idemHeaders,
    body: idemBody
  });
  const replayCall = await call(baseUrls.toolExecution, "/v1/tool-calls", "POST", {
    headers: idemHeaders,
    body: idemBody
  });

  steps.push({
    step: "verify_idempotent_finance_automation",
    expected: "duplicate submission replays prior tool call safely",
    status: replayCall.status,
    data: {
      firstCallId: firstCall.payload.toolCallId,
      replayCallId: replayCall.payload.toolCallId,
      replayed: replayCall.payload.idempotentReplay === true
    }
  });

  const policyDecision = await call(baseUrls.gateway, "/v1/policy/evaluate", "POST", {
    headers: { authorization: `Bearer ${tokens.admin}` },
    body: {
      action: "finance.close.review",
      classification: "CONFIDENTIAL",
      riskLevel: "medium",
      mode: "live",
      zeroRetentionRequested: true,
      estimatedToolCalls: 3
    }
  });

  steps.push({
    step: "validate_finance_policy_obligations",
    expected: "decision includes outbound DLP/logging obligations",
    status: policyDecision.status,
    data: {
      effect: policyDecision.payload.decision?.effect,
      obligations: policyDecision.payload.decision?.obligations ?? []
    }
  });

  const passed =
    registry.status === 200 &&
    blockedEmailExecution.status === 403 &&
    blockedEmailExecution.payload.guardReason === "approval_missing" &&
    firstCall.status === 200 &&
    replayCall.status === 200 &&
    replayCall.payload.idempotentReplay === true &&
    firstCall.payload.toolCallId === replayCall.payload.toolCallId &&
    policyDecision.status === 200 &&
    Array.isArray(policyDecision.payload.decision?.obligations) &&
    policyDecision.payload.decision.obligations.includes("dlp_scan_required");

  return makeExample({
    exampleId: "finance-operations-guardrails",
    title: "Finance Close Guardrail Assistant",
    persona: "Finance operations manager",
    domain: "Finance Ops",
    problemSolved: "Prevents accidental outbound leakage while keeping recurring automation reliable.",
    trustControlsProven: [
      "Connector registry governance",
      "Tool runtime guard enforcement",
      "Idempotency protection",
      "Policy obligations for live outputs"
    ],
    steps,
    passed,
    summary: passed
      ? "Finance automation stayed controlled: unsafe export blocked, retries idempotent, obligations attached."
      : "Finance guardrail scenario did not fully validate."
  });
};

const runSecOpsExample = async (tokens) => {
  const steps = [];

  const saveWithoutBreakGlass = await call(baseUrls.gateway, "/v1/policies/profile/save", "POST", {
    headers: { authorization: `Bearer ${tokens.security}` },
    body: {
      profileName: "SecOps emergency draft",
      changeSummary: "Attempt to disable SECRET deny without break-glass.",
      controls: { enforceSecretDeny: false }
    }
  });

  steps.push({
    step: "block_unsafe_policy_change_without_break_glass",
    expected: "422 response requiring break-glass",
    status: saveWithoutBreakGlass.status,
    data: { error: saveWithoutBreakGlass.payload.error }
  });

  const saveWithBreakGlass = await call(baseUrls.gateway, "/v1/policies/profile/save", "POST", {
    headers: { authorization: `Bearer ${tokens.security}` },
    body: {
      profileName: "SecOps emergency draft",
      changeSummary: "Temporary controlled exception for tabletop security drill.",
      controls: { enforceSecretDeny: false },
      breakGlass: {
        ticketId: "SEC-90210",
        justification: "Tabletop containment drill with dual approval and immediate rollback.",
        approverIds: ["security-lead-1", "compliance-lead-2"]
      }
    }
  });

  steps.push({
    step: "allow_policy_change_with_dual_approval_break_glass",
    expected: "200 response with breakGlassUsed=true",
    status: saveWithBreakGlass.status,
    data: {
      breakGlassUsed: saveWithBreakGlass.payload.breakGlassUsed,
      profileVersion: saveWithBreakGlass.payload.profile?.profileVersion
    }
  });

  const killHeaders = {
    "x-actor-id": "user-security",
    "x-tenant-id": "tenant-starlight-health",
    "x-roles": "security_admin,platform_admin"
  };
  const trigger = await call(baseUrls.killSwitch, "/v1/kill-switch/trigger", "POST", {
    headers: killHeaders,
    body: {
      tenantId: "tenant-starlight-health",
      workflowId: "wf-discharge-assistant",
      serviceName: "tool-execution-service",
      reason: "Automated containment during trust proof drill",
      severity: "critical"
    }
  });
  const statusAfterTrigger = await call(
    baseUrls.killSwitch,
    "/v1/kill-switch/status?tenantId=tenant-starlight-health&status=triggered",
    "GET",
    { headers: killHeaders }
  );

  const release = await call(baseUrls.killSwitch, "/v1/kill-switch/release", "POST", {
    headers: killHeaders,
    body: {
      circuitId: trigger.payload.circuit?.circuitId,
      reason: "Containment drill complete"
    }
  });
  const events = await call(baseUrls.killSwitch, "/v1/kill-switch/events?tenantId=tenant-starlight-health", "GET", {
    headers: killHeaders
  });

  steps.push({
    step: "trigger_and_release_kill_switch",
    expected: "triggered then released with immutable event chain",
    status: release.status,
    data: {
      triggerStatus: trigger.payload.circuit?.status,
      releasedStatus: release.payload.circuit?.status,
      chainValid: events.payload.chainVerification?.valid ?? false,
      eventCount: events.payload.events?.length ?? 0
    }
  });

  const restoreBaseline = await call(baseUrls.gateway, "/v1/policies/profile/save", "POST", {
    headers: { authorization: `Bearer ${tokens.security}` },
    body: {
      profileName: "Hospital Safe Baseline",
      changeSummary: "Restore secure default baseline after drill.",
      controls: baselineControls
    }
  });

  steps.push({
    step: "restore_secure_policy_baseline",
    expected: "secure defaults restored without break-glass",
    status: restoreBaseline.status,
    data: {
      enforceSecretDeny: restoreBaseline.payload.profile?.controls?.enforceSecretDeny,
      profileVersion: restoreBaseline.payload.profile?.profileVersion
    }
  });

  const passed =
    saveWithoutBreakGlass.status === 422 &&
    saveWithBreakGlass.status === 200 &&
    saveWithBreakGlass.payload.breakGlassUsed === true &&
    trigger.status >= 200 &&
    trigger.status < 300 &&
    statusAfterTrigger.status === 200 &&
    (statusAfterTrigger.payload.totals?.active ?? 0) >= 1 &&
    release.status === 200 &&
    events.status === 200 &&
    events.payload.chainVerification?.valid === true &&
    restoreBaseline.status === 200 &&
    restoreBaseline.payload.profile?.controls?.enforceSecretDeny === true;

  return makeExample({
    exampleId: "secops-containment-and-governance",
    title: "SecOps Containment and Policy Governance",
    persona: "Security operations lead",
    domain: "Security Operations",
    problemSolved: "Allows rapid emergency containment and controlled policy exceptions with full auditability.",
    trustControlsProven: [
      "Break-glass governance with dual approval metadata",
      "Kill-switch scoped containment",
      "Immutable event chain verification",
      "Safe baseline restoration"
    ],
    steps,
    passed,
    summary: passed
      ? "SecOps controls validated: unsafe changes blocked, emergency path controlled, baseline restored."
      : "SecOps trust controls did not fully validate."
  });
};

export const runTrustLayerProof = async () => {
  await rm(".volumes/pilot-state.json", { force: true });
  await rm(".volumes/tool-registry-state.json", { force: true });
  await rm(".volumes/tool-execution-state.json", { force: true });
  await rm(".volumes/kill-switch-service-state.json", { force: true });

  const servers = {
    gateway: createGatewayServer(),
    toolRegistry: createToolRegistryServer(),
    toolExecution: createToolExecutionServer(),
    killSwitch: createKillSwitchServer()
  };

  servers.gateway.listen(ports.gateway);
  servers.toolRegistry.listen(ports.toolRegistry);
  servers.toolExecution.listen(ports.toolExecution);
  servers.killSwitch.listen(ports.killSwitch);
  await Promise.all([
    once(servers.gateway, "listening"),
    once(servers.toolRegistry, "listening"),
    once(servers.toolExecution, "listening"),
    once(servers.killSwitch, "listening")
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    suite: "trust-layer-end-to-end-proof",
    product: "OpenAegis",
    endpoints: baseUrls,
    examples: [],
    summary: {
      totalExamples: 0,
      passedExamples: 0,
      failedExamples: 0,
      scorePercent: 0,
      status: "FAIL"
    }
  };

  try {
    const [clinicianLogin, securityLogin, adminLogin] = await Promise.all([
      call(baseUrls.gateway, "/v1/auth/login", "POST", {
        body: { email: "clinician@starlighthealth.org" }
      }),
      call(baseUrls.gateway, "/v1/auth/login", "POST", {
        body: { email: "security@starlighthealth.org" }
      }),
      call(baseUrls.gateway, "/v1/auth/login", "POST", {
        body: { email: "admin@starlighthealth.org" }
      })
    ]);

    if (clinicianLogin.status !== 200 || securityLogin.status !== 200 || adminLogin.status !== 200) {
      throw new Error("unable_to_authenticate_demo_users_for_trust_layer_proof");
    }

    const tokens = {
      clinician: clinicianLogin.payload.accessToken,
      security: securityLogin.payload.accessToken,
      admin: adminLogin.payload.accessToken
    };

    const examples = [
      await runHealthcareDischargeExample(tokens),
      await runFinanceOpsExample(tokens),
      await runSecOpsExample(tokens)
    ];

    report.examples = examples;
    report.summary.totalExamples = examples.length;
    report.summary.passedExamples = examples.filter((example) => example.passed).length;
    report.summary.failedExamples = report.summary.totalExamples - report.summary.passedExamples;
    report.summary.scorePercent = Math.round((report.summary.passedExamples / report.summary.totalExamples) * 100);
    report.summary.status = report.summary.failedExamples === 0 ? "PASS" : "FAIL";
  } finally {
    servers.gateway.close();
    servers.toolRegistry.close();
    servers.toolExecution.close();
    servers.killSwitch.close();
    await Promise.all([
      once(servers.gateway, "close"),
      once(servers.toolRegistry, "close"),
      once(servers.toolExecution, "close"),
      once(servers.killSwitch, "close")
    ]);
  }

  await mkdir("docs/assets/demo", { recursive: true });
  await writeFile("docs/assets/demo/trust-layer-proof-report.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runTrustLayerProof()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (report.summary.status !== "PASS") process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

