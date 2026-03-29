export interface AuditEvidence {
  evidenceId: string;
  executionId: string;
  actorId: string;
  tenantId: string;
  dataSources: string[];
  policyIds: string[];
  modelRoute?: {
    provider: string;
    modelId: string;
    traceId: string;
  };
  toolCalls: Array<{
    toolId: string;
    callId: string;
    status: "completed" | "blocked" | "failed";
  }>;
  approvals: Array<{
    approvalId: string;
    approverId: string;
    decision: "approved" | "rejected";
    timestamp: string;
  }>;
  outputClassification: string;
  blocked: boolean;
  finalDisposition: "completed" | "blocked" | "failed" | "killed";
  hash: string;
  prevHash?: string;
}