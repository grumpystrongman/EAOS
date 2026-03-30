import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  ApprovalTicket,
  EvidenceEnvelope,
  ModelInferenceRequest,
  PolicyDecision,
  ToolExecutionRequest
} from "./index.js";

test("contract shapes can represent regulated workflow decisions", () => {
  const decision: PolicyDecision = {
    decisionId: "dec-1",
    effect: "REQUIRE_APPROVAL",
    obligations: ["human_approval", "dlp_scan_required"],
    reasons: ["high_risk_live_action_requires_human_approval"],
    matchedPolicyIds: ["policy-ep-hi-001"],
    ttlSeconds: 60
  };

  const approval: ApprovalTicket = {
    approvalId: "ap-1",
    tenantId: "tenant-starlight-health",
    requestedBy: "user-clinician",
    riskLevel: "high",
    requirement: {
      mode: "dual",
      minApprovers: 2,
      approverRoles: ["security_admin", "compliance_officer"],
      reason: "EPHI outbound follow-up communication",
      expiresAt: "2026-03-31T00:00:00.000Z"
    },
    status: "pending"
  };

  assert.equal(decision.effect, "REQUIRE_APPROVAL");
  assert.equal(approval.requirement.minApprovers, 2);
});

test("contract shapes capture model/tool requests and evidence chain fields", () => {
  const modelRequest: ModelInferenceRequest = {
    requestId: "model-1",
    tenantId: "tenant-starlight-health",
    capabilityRequirements: ["summarization", "json_schema_output"],
    sensitivity: "EPHI",
    promptEnvelopeRef: "obj://tenant-starlight-health/prompts/req-1.json",
    zeroRetentionRequired: true
  };

  const toolRequest: ToolExecutionRequest = {
    executionId: "ex-1",
    toolId: "fhir.read-patient",
    action: "READ",
    idempotencyKey: "idem-1",
    networkProfile: "allowlisted",
    params: { patientId: "patient-1001" }
  };

  const evidence: EvidenceEnvelope = {
    evidenceId: "ev-1",
    timestamp: "2026-03-30T00:00:00.000Z",
    tenantId: "tenant-starlight-health",
    actorId: "user-security",
    executionId: "ex-1",
    policyDecisionIds: ["dec-1"],
    approvalIds: ["ap-1"],
    modelTraceId: "trace-1",
    toolCallIds: ["tc-1", "tc-2"],
    finalDisposition: "completed",
    hash: "abc123",
    prevHash: "prev123"
  };

  assert.equal(modelRequest.zeroRetentionRequired, true);
  assert.equal(toolRequest.action, "READ");
  assert.equal(evidence.finalDisposition, "completed");
});

