import assert from "node:assert/strict";
import { test } from "node:test";
import { APP_ROUTES, canAccessRoute } from "./routes.js";
import type { SessionContext } from "../shared/auth/session.js";

const adminSession: SessionContext = {
  userId: "user-admin",
  tenantId: "tenant-starlight-health",
  roles: ["platform_admin", "security_admin", "auditor", "workflow_operator", "approver", "analyst"],
  assuranceLevel: "aal3"
};

const analystSession: SessionContext = {
  userId: "user-analyst",
  tenantId: "tenant-starlight-health",
  roles: ["analyst"],
  assuranceLevel: "aal2"
};

test("route catalog includes required consoles for MVP", () => {
  const paths = APP_ROUTES.map((route) => route.path);
  assert.ok(paths.includes("/security"));
  assert.ok(paths.includes("/simulation"));
  assert.ok(paths.includes("/commercial"));
});

test("canAccessRoute enforces all required roles", () => {
  const dashboardRoute = APP_ROUTES.find((route) => route.path === "/dashboard");
  const approvalsRoute = APP_ROUTES.find((route) => route.path === "/approvals");

  assert.ok(dashboardRoute);
  assert.ok(approvalsRoute);
  if (!dashboardRoute || !approvalsRoute) return;

  assert.equal(canAccessRoute(analystSession, dashboardRoute), true);
  assert.equal(canAccessRoute(analystSession, approvalsRoute), false);
  assert.equal(canAccessRoute(adminSession, approvalsRoute), true);
});

test("high-risk routes are marked with step-up MFA requirement", () => {
  const stepUpPaths = APP_ROUTES.filter((route) => route.requireStepUpMfa).map((route) => route.path);
  assert.ok(stepUpPaths.includes("/approvals"));
  assert.ok(stepUpPaths.includes("/incidents"));
});

