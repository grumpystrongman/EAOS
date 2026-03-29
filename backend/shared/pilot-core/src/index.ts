import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type PilotMode = "simulation" | "live";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ExecutionStatus = "queued" | "running" | "blocked" | "completed" | "failed";

export interface UserRecord {
  userId: string;
  email: string;
  displayName: string;
  roles: string[];
  assuranceLevel: "aal1" | "aal2" | "aal3";
  tenantId: string;
}

export interface FhirPatient {
  patientId: string;
  name: string;
  mrn: string;
  diagnosis: string;
  attendingPhysician: string;
  dischargeReadinessScore: number;
}

export interface CarePlanRecord {
  patientId: string;
  planId: string;
  tasks: string[];
  pendingLabs: string[];
}

export interface AuditEvent {
  eventId: string;
  timestamp: string;
  tenantId: string;
  actorId: string;
  category: string;
  action: string;
  status: "success" | "blocked" | "failure";
  details: Record<string, unknown>;
  evidenceId: string;
}

export interface ApprovalRecord {
  approvalId: string;
  executionId?: string;
  tenantId: string;
  requestedBy: string;
  reason: string;
  riskLevel: "high" | "critical";
  requiredApprovers: number;
  approvers: Array<{ approverId: string; decision: "approved" | "rejected"; reason?: string; decidedAt: string }>;
  status: ApprovalStatus;
  createdAt: string;
  expiresAt: string;
}

export interface ModelRouteDecision {
  provider: "openai" | "anthropic" | "google" | "azure" | "self_hosted";
  modelId: string;
  zeroRetention: boolean;
  reasonCodes: string[];
  score: {
    cost: number;
    latency: number;
    risk: number;
    total: number;
  };
}

export interface ToolCallRecord {
  toolCallId: string;
  executionId: string;
  toolId: string;
  action: "READ" | "WRITE" | "EXECUTE";
  status: "completed" | "blocked" | "failed";
  resultRef?: string;
  classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "PII" | "PHI" | "EPHI" | "SECRET";
  createdAt: string;
}

export interface ExecutionRecord {
  executionId: string;
  workflowId: string;
  mode: PilotMode;
  tenantId: string;
  actorId: string;
  patientId: string;
  status: ExecutionStatus;
  currentStep: string;
  output?: {
    summary: string;
    recommendation: string;
    riskFlags: string[];
  };
  blockedReason?: string;
  approvalId?: string;
  modelRoute?: ModelRouteDecision;
  toolCalls: string[];
  evidenceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PilotState {
  users: UserRecord[];
  fhirPatients: FhirPatient[];
  carePlans: CarePlanRecord[];
  approvals: ApprovalRecord[];
  executions: ExecutionRecord[];
  toolCalls: ToolCallRecord[];
  auditEvents: AuditEvent[];
}

const nowIso = () => new Date().toISOString();

const makeId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

export const defaultState = (): PilotState => ({
  users: [
    {
      userId: "u-clinician-1",
      email: "clinician@starlighthealth.org",
      displayName: "Dr. Maya Chen",
      roles: ["clinician", "workflow_operator"],
      assuranceLevel: "aal2",
      tenantId: "tenant-starlight-health"
    },
    {
      userId: "u-security-1",
      email: "security@starlighthealth.org",
      displayName: "Avery Brooks",
      roles: ["security_admin", "approver", "auditor"],
      assuranceLevel: "aal3",
      tenantId: "tenant-starlight-health"
    }
  ],
  fhirPatients: [
    {
      patientId: "patient-1001",
      name: "Jordan Lee",
      mrn: "MRN-847120",
      diagnosis: "Community-acquired pneumonia",
      attendingPhysician: "Dr. Maya Chen",
      dischargeReadinessScore: 78
    }
  ],
  carePlans: [
    {
      patientId: "patient-1001",
      planId: "cp-2201",
      tasks: [
        "Complete oral antibiotic transition",
        "Schedule 48-hour telehealth follow-up",
        "Provide discharge education packet"
      ],
      pendingLabs: ["CBC trend", "Pulse oximetry at ambulation"]
    }
  ],
  approvals: [],
  executions: [],
  toolCalls: [],
  auditEvents: []
});

export const stateFilePath = () => resolve(".volumes", "pilot-state.json");

const ensureStateDir = async (path: string) => {
  await mkdir(dirname(path), { recursive: true });
};

export const loadState = async (): Promise<PilotState> => {
  const path = stateFilePath();
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as PilotState;
  } catch {
    const initial = defaultState();
    await ensureStateDir(path);
    await writeFile(path, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
};

export const saveState = async (state: PilotState): Promise<void> => {
  const path = stateFilePath();
  await ensureStateDir(path);
  await writeFile(path, JSON.stringify(state, null, 2), "utf8");
};

export interface PolicyEvaluationInput {
  action: string;
  classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "PII" | "PHI" | "EPHI" | "SECRET";
  riskLevel: "low" | "medium" | "high" | "critical";
  mode: PilotMode;
  zeroRetentionRequested?: boolean;
}

export interface PolicyEvaluationResult {
  decisionId: string;
  effect: "ALLOW" | "DENY" | "REQUIRE_APPROVAL";
  reasons: string[];
  obligations: string[];
  ttlSeconds: number;
}

export const evaluatePolicy = (input: PolicyEvaluationInput): PolicyEvaluationResult => {
  const decisionId = makeId("pd");

  if (input.classification === "SECRET") {
    return {
      decisionId,
      effect: "DENY",
      reasons: ["secret_data_cannot_be_processed_by_agent_workflow"],
      obligations: [],
      ttlSeconds: 300
    };
  }

  if ((input.classification === "PHI" || input.classification === "EPHI") && !input.zeroRetentionRequested) {
    return {
      decisionId,
      effect: "DENY",
      reasons: ["zero_retention_required_for_phi_or_ephi"],
      obligations: [],
      ttlSeconds: 300
    };
  }

  if (input.riskLevel === "high" || input.riskLevel === "critical") {
    return {
      decisionId,
      effect: "REQUIRE_APPROVAL",
      reasons: ["high_risk_action_requires_human_approval"],
      obligations: ["dual_approval", "audit_envelope_required"],
      ttlSeconds: 300
    };
  }

  return {
    decisionId,
    effect: "ALLOW",
    reasons: ["policy_conditions_satisfied"],
    obligations: ["audit_envelope_required"],
    ttlSeconds: 300
  };
};

export const createApproval = (input: {
  tenantId: string;
  requestedBy: string;
  reason: string;
  riskLevel: "high" | "critical";
  executionId?: string;
}): ApprovalRecord => {
  const approval: ApprovalRecord = {
    approvalId: makeId("ap"),
    tenantId: input.tenantId,
    requestedBy: input.requestedBy,
    reason: input.reason,
    riskLevel: input.riskLevel,
    requiredApprovers: input.riskLevel === "critical" ? 2 : 1,
    approvers: [],
    status: "pending",
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
  };
  if (input.executionId) {
    approval.executionId = input.executionId;
  }
  return approval;
};

export const applyApprovalDecision = (
  approval: ApprovalRecord,
  input: { approverId: string; decision: "approved" | "rejected"; reason?: string }
): ApprovalRecord => {
  const decisionRecord: { approverId: string; decision: "approved" | "rejected"; reason?: string; decidedAt: string } = {
    approverId: input.approverId,
    decision: input.decision,
    decidedAt: nowIso()
  };
  if (input.reason) {
    decisionRecord.reason = input.reason;
  }

  const updated: ApprovalRecord = {
    ...approval,
    approvers: [...approval.approvers, decisionRecord]
  };

  const approvals = updated.approvers.filter((item) => item.decision === "approved").length;
  const rejects = updated.approvers.filter((item) => item.decision === "rejected").length;

  if (rejects > 0) {
    updated.status = "rejected";
  } else if (approvals >= updated.requiredApprovers) {
    updated.status = "approved";
  }

  return updated;
};

export const routeModel = (input: {
  classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "PII" | "PHI" | "EPHI" | "SECRET";
  zeroRetentionRequired: boolean;
}): ModelRouteDecision => {
  if (input.classification === "EPHI" || input.classification === "SECRET") {
    return {
      provider: "self_hosted",
      modelId: "llama-3.1-70b-instruct",
      zeroRetention: true,
      reasonCodes: ["highest_sensitivity_prefers_self_hosted"],
      score: { cost: 0.61, latency: 0.66, risk: 0.98, total: 0.81 }
    };
  }

  return {
    provider: "azure",
    modelId: "gpt-4.1-mini",
    zeroRetention: input.zeroRetentionRequired,
    reasonCodes: ["policy_allowed", "balanced_cost_latency_risk"],
    score: { cost: 0.72, latency: 0.84, risk: 0.92, total: 0.86 }
  };
};

export const createToolCall = (input: {
  executionId: string;
  toolId: string;
  action: "READ" | "WRITE" | "EXECUTE";
  status: "completed" | "blocked" | "failed";
  classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "PII" | "PHI" | "EPHI" | "SECRET";
  resultRef?: string;
}): ToolCallRecord => {
  const toolCall: ToolCallRecord = {
    toolCallId: makeId("tc"),
    executionId: input.executionId,
    toolId: input.toolId,
    action: input.action,
    status: input.status,
    classification: input.classification,
    createdAt: nowIso()
  };
  if (input.resultRef) {
    toolCall.resultRef = input.resultRef;
  }
  return toolCall;
};

export const createAuditEvent = (input: Omit<AuditEvent, "eventId" | "timestamp" | "evidenceId">): AuditEvent => ({
  eventId: makeId("ae"),
  timestamp: nowIso(),
  evidenceId: makeId("ev"),
  ...input
});

export const buildDischargeSummary = (patient: FhirPatient, plan: CarePlanRecord) => {
  const summary = `Patient ${patient.name} (${patient.mrn}) is at discharge readiness score ${patient.dischargeReadinessScore}. Diagnosis: ${patient.diagnosis}.`;
  const recommendation = `Proceed with discharge once pending labs are reviewed. Complete tasks: ${plan.tasks.join("; ")}.`;
  const riskFlags = patient.dischargeReadinessScore < 75 ? ["readiness_below_threshold"] : ["standard_monitoring"];
  return { summary, recommendation, riskFlags };
};
