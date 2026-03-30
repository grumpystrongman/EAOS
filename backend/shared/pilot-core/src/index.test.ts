import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { beforeEach, test } from "node:test";
import {
  defaultPolicyControls,
  evaluatePolicy,
  evaluatePolicyProfileReadiness,
  resolveApprovalAndAdvanceExecution,
  savePolicyProfile,
  startDischargeAssistantExecution
} from "./index.js";

beforeEach(async () => {
  await rm(".volumes/pilot-state.json", { force: true });
});

test("evaluatePolicy denies secret data and oversized tool budgets", () => {
  const controls = defaultPolicyControls();
  const secretDecision = evaluatePolicy(
    {
      action: "tool.execute",
      classification: "SECRET",
      riskLevel: "critical",
      mode: "live",
      zeroRetentionRequested: true
    },
    controls
  );
  assert.equal(secretDecision.effect, "DENY");
  assert.ok(secretDecision.reasons.includes("secret_data_must_not_leave_trusted_boundary"));

  const toolBudgetDecision = evaluatePolicy(
    {
      action: "workflow.execute",
      classification: "EPHI",
      riskLevel: "medium",
      mode: "simulation",
      zeroRetentionRequested: true,
      estimatedToolCalls: 99
    },
    controls
  );
  assert.equal(toolBudgetDecision.effect, "DENY");
  assert.ok(toolBudgetDecision.reasons.includes("estimated_tool_calls_exceed_policy_budget"));
});

test("evaluatePolicyProfileReadiness flags blocking and warning issues", () => {
  const readiness = evaluatePolicyProfileReadiness({
    enforceSecretDeny: false,
    requireZeroRetentionForPhi: false,
    requireApprovalForHighRiskLive: false,
    requireDlpOnOutbound: false,
    restrictExternalProvidersToZeroRetention: false,
    maxToolCallsPerExecution: 15
  });

  assert.equal(readiness.valid, false);
  assert.ok(readiness.issues.some((issue) => issue.code === "secret_deny_disabled"));
  assert.ok(readiness.issues.some((issue) => issue.code === "zero_retention_phi_disabled"));
  assert.ok(readiness.issues.some((issue) => issue.code === "tool_budget_high"));
  assert.ok(readiness.simulation.warnings.length > 0);
});

test("savePolicyProfile requires security role and break-glass for blocking profile", async () => {
  const denied = await savePolicyProfile({
    actorId: "user-clinician",
    tenantId: "tenant-starlight-health",
    changeSummary: "Attempt unsafe change without role",
    draftControls: {
      enforceSecretDeny: false
    }
  });
  assert.equal(denied.status, 403);

  const blocked = await savePolicyProfile({
    actorId: "user-security",
    tenantId: "tenant-starlight-health",
    changeSummary: "Disable secret deny for test",
    draftControls: {
      enforceSecretDeny: false
    }
  });
  assert.equal(blocked.status, 422);

  const overridden = await savePolicyProfile({
    actorId: "user-security",
    tenantId: "tenant-starlight-health",
    changeSummary: "Emergency exception for controlled tabletop drill",
    draftControls: {
      enforceSecretDeny: false
    },
    breakGlass: {
      ticketId: "INC-4099",
      justification: "Approved tabletop drill with temporary exception and rollback plan.",
      approverIds: ["security-lead-1", "compliance-lead-2"]
    }
  });
  assert.equal(overridden.status, 200);
  assert.equal(overridden.body.breakGlassUsed, true);
  assert.equal(overridden.body.profile.profileVersion, 2);
  assert.equal(overridden.body.profile.controls.enforceSecretDeny, false);
});

test("live high-risk execution blocks for approval then completes after approval", async () => {
  const started = await startDischargeAssistantExecution({
    actorId: "user-clinician",
    patientId: "patient-1001",
    mode: "live",
    workflowId: "wf-discharge-assistant",
    tenantId: "tenant-starlight-health",
    requestFollowupEmail: true
  });

  assert.equal("status" in started, false);
  if ("status" in started) return;

  assert.equal(started.execution.status, "blocked");
  assert.ok(started.approval?.approvalId);
  assert.equal(started.graphExecution.status, "waiting_for_approval");
  assert.equal(started.graphExecution.steps[0]?.stage, "planner");
  assert.equal(started.graphExecution.steps[1]?.stage, "executor");

  const approvalId = started.approval?.approvalId;
  assert.ok(approvalId);
  const resolved = await resolveApprovalAndAdvanceExecution({
    approvalId: approvalId!,
    actorId: "user-security",
    decision: "approved",
    reason: "Clinical criteria validated"
  });

  assert.equal("status" in resolved, false);
  if ("status" in resolved) return;
  assert.equal(resolved.execution.status, "completed");
  assert.equal(resolved.graphExecution.status, "completed");
  assert.equal(resolved.graphExecution.steps.length, 3);
  assert.equal(resolved.graphExecution.steps[2]?.stage, "reviewer");
});

test("low-readiness patient triggers reviewer rejection incident", async () => {
  const result = await startDischargeAssistantExecution({
    actorId: "user-clinician",
    patientId: "patient-2002",
    mode: "simulation",
    workflowId: "wf-discharge-assistant",
    tenantId: "tenant-starlight-health",
    requestFollowupEmail: false
  });

  assert.equal("status" in result, false);
  if ("status" in result) return;

  assert.equal(result.execution.status, "failed");
  assert.equal(result.graphExecution.status, "failed");
  assert.equal(result.execution.currentStep, "review_rejected");
  assert.ok(result.execution.incidentId);
  assert.equal(result.incident?.category, "review_rejection");
});
