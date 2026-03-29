import type { SessionContext, UserRole } from "../shared/auth/session.js";

export interface AppRoute {
  path: string;
  title: string;
  requiredRoles: UserRole[];
  requireStepUpMfa?: boolean;
}

export const APP_ROUTES: AppRoute[] = [
  { path: "/dashboard", title: "Business KPI Dashboard", requiredRoles: ["analyst"] },
  { path: "/admin", title: "Admin Console", requiredRoles: ["platform_admin"] },
  { path: "/security", title: "Security Console", requiredRoles: ["security_admin"] },
  { path: "/agents", title: "Agent Builder", requiredRoles: ["workflow_operator"] },
  { path: "/workflows", title: "Workflow Designer", requiredRoles: ["workflow_operator"] },
  { path: "/approvals", title: "Approval Inbox", requiredRoles: ["approver"], requireStepUpMfa: true },
  { path: "/incidents", title: "Incident Review Explorer", requiredRoles: ["security_admin", "auditor"], requireStepUpMfa: true },
  { path: "/audit", title: "Audit Explorer", requiredRoles: ["auditor"] },
  { path: "/simulation", title: "Simulation Lab", requiredRoles: ["workflow_operator"] }
];

export const canAccessRoute = (session: SessionContext, route: AppRoute): boolean =>
  route.requiredRoles.every((role) => session.roles.includes(role));