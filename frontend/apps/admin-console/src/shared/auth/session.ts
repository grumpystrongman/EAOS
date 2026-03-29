export type UserRole =
  | "platform_admin"
  | "security_admin"
  | "auditor"
  | "workflow_operator"
  | "approver"
  | "analyst";

export interface SessionContext {
  userId: string;
  tenantId: string;
  roles: UserRole[];
  assuranceLevel: "aal1" | "aal2" | "aal3";
}

export const hasAllRoles = (ctx: SessionContext, required: UserRole[]): boolean =>
  required.every((role) => ctx.roles.includes(role));