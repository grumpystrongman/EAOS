import type {
  ApprovalTicket,
  EvidenceEnvelope,
  ModelInferenceRequest,
  PolicyDecision,
  ToolExecutionRequest
} from "@eaos/contracts";

export type EAOSEventType =
  | "policy.decision.emitted"
  | "approval.requested"
  | "approval.decided"
  | "model.inference.requested"
  | "model.inference.completed"
  | "tool.execution.requested"
  | "tool.execution.completed"
  | "execution.blocked"
  | "execution.completed"
  | "audit.evidence.committed"
  | "kill-switch.activated";

export interface EventEnvelope<TPayload> {
  eventId: string;
  eventType: EAOSEventType;
  tenantId: string;
  correlationId: string;
  causationId?: string;
  timestamp: string;
  producer: string;
  payload: TPayload;
  classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "PII" | "PHI" | "EPHI" | "SECRET";
  integrity: {
    algorithm: "SHA256";
    hash: string;
  };
}

export type PolicyDecisionEvent = EventEnvelope<PolicyDecision>;
export type ApprovalRequestedEvent = EventEnvelope<ApprovalTicket>;
export type ModelInferenceRequestedEvent = EventEnvelope<ModelInferenceRequest>;
export type ToolExecutionRequestedEvent = EventEnvelope<ToolExecutionRequest>;
export type AuditEvidenceCommittedEvent = EventEnvelope<EvidenceEnvelope>;