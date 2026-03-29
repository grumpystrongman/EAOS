export type SecurityTier = "regulated" | "standard";

export interface ServiceDescriptor {
  serviceName: string;
  listeningPort: number;
  purpose: string;
  securityTier: SecurityTier;
  requiresMTLS: boolean;
  requiresTenantContext: boolean;
  defaultDeny: boolean;
}

export type DataClass =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "PII"
  | "PHI"
  | "EPHI"
  | "SECRET";

export type DecisionEffect = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

export interface TenantContext {
  tenantId: string;
  region: string;
  environment: "dev" | "staging" | "prod";
}

export interface ActorContext {
  actorId: string;
  actorType: "human" | "service";
  roles: string[];
  attributes: Record<string, string | number | boolean>;
  sessionAssuranceLevel: "aal1" | "aal2" | "aal3";
}

export interface PolicyInput {
  action: string;
  resource: string;
  dataClasses: DataClass[];
  purpose: string;
  destination?: string;
  toolId?: string;
  modelId?: string;
}

export interface PolicyDecision {
  decisionId: string;
  effect: DecisionEffect;
  obligations: string[];
  reasons: string[];
  matchedPolicyIds: string[];
  ttlSeconds: number;
}

export interface ApprovalRequirement {
  mode: "single" | "dual" | "quorum";
  minApprovers: number;
  approverRoles: string[];
  reason: string;
  expiresAt: string;
}

export interface ApprovalTicket {
  approvalId: string;
  tenantId: string;
  requestedBy: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  requirement: ApprovalRequirement;
  status: "pending" | "approved" | "rejected" | "expired";
}

export interface AgentExecutionRequest {
  executionId: string;
  workflowId: string;
  mode: "simulation" | "live";
  stepBudget: number;
  tokenBudget: number;
  maxRuntimeSeconds: number;
  tenant: TenantContext;
  actor: ActorContext;
  inputClassification: DataClass[];
}

export interface ToolExecutionRequest {
  executionId: string;
  toolId: string;
  action: "READ" | "WRITE" | "EXECUTE";
  idempotencyKey: string;
  networkProfile: "none" | "allowlisted";
  params: Record<string, unknown>;
}

export interface ModelInferenceRequest {
  requestId: string;
  tenantId: string;
  providerHint?: string;
  capabilityRequirements: string[];
  sensitivity: DataClass;
  promptEnvelopeRef: string;
  outputSchemaRef?: string;
  zeroRetentionRequired: boolean;
}

export interface EvidenceEnvelope {
  evidenceId: string;
  timestamp: string;
  tenantId: string;
  actorId: string;
  executionId?: string;
  policyDecisionIds: string[];
  approvalIds: string[];
  modelTraceId?: string;
  toolCallIds: string[];
  finalDisposition: "completed" | "blocked" | "failed" | "killed";
  hash: string;
  prevHash?: string;
}