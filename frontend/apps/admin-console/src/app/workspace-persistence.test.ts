import assert from "node:assert/strict";
import { test } from "node:test";
import { workspacePersistSnapshot } from "./workspace-persistence.js";

test("workspace persistence omits session tokens from storage", () => {
  const snapshot = workspacePersistSnapshot({
    activePersona: "security",
    clinicianSession: {
      accessToken: "clinician-token",
      expiresAt: "2026-03-31T00:00:00.000Z",
      user: {
        userId: "user-clinician",
        email: "clinician@example.com",
        displayName: "Clinician",
        roles: ["workflow_operator"],
        assuranceLevel: "aal2",
        tenantId: "tenant-starlight-health"
      }
    },
    securitySession: {
      accessToken: "security-token",
      expiresAt: "2026-03-31T00:00:00.000Z",
      user: {
        userId: "user-security",
        email: "security@example.com",
        displayName: "Security",
        roles: ["security_admin"],
        assuranceLevel: "aal3",
        tenantId: "tenant-starlight-health"
      }
    },
    trackedExecutionIds: ["exec-1"],
    executions: [],
    approvals: [],
    auditEvents: [],
    incidents: [],
    integrations: [],
    directoryUsers: [],
    commercialProof: undefined,
    commercialClaims: undefined,
    commercialReadiness: undefined,
    policySnapshot: undefined,
    policyCopilot: undefined,
    policyImpactReview: undefined,
    modelPreview: undefined,
    lastSyncedAt: undefined,
    isBootstrapping: false,
    isSyncing: false,
    error: undefined
  } as Parameters<typeof workspacePersistSnapshot>[0] & {
    clinicianSession: unknown;
    securitySession: unknown;
    executions: unknown;
    approvals: unknown;
    auditEvents: unknown;
    incidents: unknown;
    commercialProof: unknown;
    commercialClaims: unknown;
    commercialReadiness: unknown;
    policySnapshot: unknown;
    policyCopilot: unknown;
    policyImpactReview: unknown;
    modelPreview: unknown;
    lastSyncedAt: unknown;
    isBootstrapping: boolean;
    isSyncing: boolean;
    error: unknown;
  });

  assert.deepEqual(snapshot, {
    activePersona: "security",
    trackedExecutionIds: ["exec-1"],
    integrations: [],
    directoryUsers: []
  });
  assert.equal("clinicianSession" in snapshot, false);
  assert.equal("securitySession" in snapshot, false);
});
