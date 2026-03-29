export interface ToolManifest {
  toolId: string;
  version: string;
  signature: string;
  allowedActions: Array<"READ" | "WRITE" | "EXECUTE">;
  networkProfiles: string[];
}

export interface ToolCallGuardInput {
  action: "READ" | "WRITE" | "EXECUTE";
  requestedNetworkProfile: string;
  stepBudgetRemaining: number;
  requiresApproval: boolean;
  approvalGranted: boolean;
}

export const enforceToolCallGuard = (
  manifest: ToolManifest,
  input: ToolCallGuardInput
): { allowed: boolean; reason?: string } => {
  if (!manifest.allowedActions.includes(input.action)) {
    return { allowed: false, reason: "action_not_allowed" };
  }

  if (!manifest.networkProfiles.includes(input.requestedNetworkProfile)) {
    return { allowed: false, reason: "network_profile_not_allowed" };
  }

  if (input.stepBudgetRemaining <= 0) {
    return { allowed: false, reason: "step_budget_exhausted" };
  }

  if (input.requiresApproval && !input.approvalGranted) {
    return { allowed: false, reason: "approval_missing" };
  }

  return { allowed: true };
};