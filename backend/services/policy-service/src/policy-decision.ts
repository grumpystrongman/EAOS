export type Decision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

export interface PolicyDecisionRecord {
  decisionId: string;
  tenantId: string;
  action: string;
  resource: string;
  decision: Decision;
  reasonCodes: string[];
  obligations: string[];
  policyVersion: string;
  createdAt: string;
}

export const isEnforceable = (record: PolicyDecisionRecord): boolean =>
  record.decision === "ALLOW" || record.decision === "REQUIRE_APPROVAL";