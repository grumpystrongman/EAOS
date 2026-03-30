import assert from "node:assert/strict";
import { test } from "node:test";
import { hasAllRoles, type SessionContext } from "./session.js";

const securitySession: SessionContext = {
  userId: "user-security",
  tenantId: "tenant-starlight-health",
  roles: ["security_admin", "approver", "auditor"],
  assuranceLevel: "aal3"
};

test("hasAllRoles returns true only when every required role is present", () => {
  assert.equal(hasAllRoles(securitySession, ["security_admin", "approver"]), true);
  assert.equal(hasAllRoles(securitySession, ["platform_admin"]), false);
});

