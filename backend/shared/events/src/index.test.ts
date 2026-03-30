import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import type { EventEnvelope, OpenAegisEventType } from "./index.js";

const sha256Hex = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("event envelope preserves tenant/correlation and integrity hash", () => {
  const payload = {
    decisionId: "dec-123",
    effect: "REQUIRE_APPROVAL",
    obligations: ["human_approval"]
  };

  const eventType: OpenAegisEventType = "policy.decision.emitted";
  const event: EventEnvelope<typeof payload> = {
    eventId: "evt-1",
    eventType,
    tenantId: "tenant-starlight-health",
    correlationId: "corr-1",
    causationId: "cause-1",
    timestamp: "2026-03-30T00:00:00.000Z",
    producer: "policy-service",
    payload,
    classification: "EPHI",
    integrity: {
      algorithm: "SHA256",
      hash: sha256Hex(payload)
    }
  };

  assert.equal(event.eventType, "policy.decision.emitted");
  assert.equal(event.classification, "EPHI");
  assert.equal(event.integrity.hash, sha256Hex(payload));
});

test("event type union supports kill-switch and audit evidence events", () => {
  const types: OpenAegisEventType[] = ["kill-switch.activated", "audit.evidence.committed"];
  assert.deepEqual(types, ["kill-switch.activated", "audit.evidence.committed"]);
});

