import assert from "node:assert/strict";
import { test } from "node:test";
import { APP_ROUTES } from "./routes.js";
import {
  buildPolicyDraftHash,
  canAccessRouteWithAssurance,
  hasFreshPreviewHash,
  isDemoIdentitiesEnabled
} from "./security-guards.js";
import type { SessionContext } from "../shared/auth/session.js";

const securitySession: SessionContext = {
  userId: "user-security",
  tenantId: "tenant-starlight-health",
  roles: ["security_admin", "approver", "auditor"],
  assuranceLevel: "aal3"
};

const analystSession: SessionContext = {
  userId: "user-analyst",
  tenantId: "tenant-starlight-health",
  roles: ["analyst"],
  assuranceLevel: "aal2"
};

test("demo identities are disabled by default unless the build flag is set", () => {
  const flagHost = globalThis as typeof globalThis & { __ENABLE_DEMO_IDENTITIES__?: boolean };
  const previous = flagHost.__ENABLE_DEMO_IDENTITIES__;
  try {
    delete flagHost.__ENABLE_DEMO_IDENTITIES__;
    assert.equal(isDemoIdentitiesEnabled(), false);

    flagHost.__ENABLE_DEMO_IDENTITIES__ = true;
    assert.equal(isDemoIdentitiesEnabled(), true);
  } finally {
    if (previous === undefined) {
      delete flagHost.__ENABLE_DEMO_IDENTITIES__;
    } else {
      flagHost.__ENABLE_DEMO_IDENTITIES__ = previous;
    }
  }
});

test("step-up routes require AAL3 assurance in the UI guard", () => {
  const approvalsRoute = APP_ROUTES.find((route) => route.path === "/approvals");
  const incidentsRoute = APP_ROUTES.find((route) => route.path === "/incidents");

  assert.ok(approvalsRoute);
  assert.ok(incidentsRoute);
  if (!approvalsRoute || !incidentsRoute) return;

  assert.equal(canAccessRouteWithAssurance(analystSession, approvalsRoute), false);
  assert.equal(canAccessRouteWithAssurance(securitySession, approvalsRoute), true);
  assert.equal(canAccessRouteWithAssurance(securitySession, incidentsRoute), true);
});

test("policy preview hashes gate apply until the current draft is previewed", () => {
  const draft = {
    enforceSecretDeny: true,
    requireZeroRetentionForPhi: true,
    requireApprovalForHighRiskLive: true,
    requireDlpOnOutbound: true,
    restrictExternalProvidersToZeroRetention: true,
    maxToolCallsPerExecution: 8
  };

  const previewHash = buildPolicyDraftHash("Hospital Safe Baseline", draft);
  assert.equal(hasFreshPreviewHash(previewHash, "Hospital Safe Baseline", draft), true);
  assert.equal(
    hasFreshPreviewHash(previewHash, "Hospital Safe Baseline", { ...draft, maxToolCallsPerExecution: 9 }),
    false
  );
});
