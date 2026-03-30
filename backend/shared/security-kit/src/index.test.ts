import assert from "node:assert/strict";
import { test } from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  InMemoryRateLimiter,
  enforceRateLimit,
  enforceSecurity,
  hmacSha256,
  parseContext,
  stableSerialize
} from "./index.js";

interface MockResponse {
  statusCode?: number;
  headers: Record<string, string>;
  payload?: string;
  writeHead: (statusCode: number, headers?: Record<string, string>) => void;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
}

const createMockResponse = (): MockResponse => {
  const response: MockResponse = {
    headers: {},
    writeHead(statusCode, headers = {}) {
      response.statusCode = statusCode;
      response.headers = { ...response.headers, ...headers };
    },
    setHeader(name, value) {
      response.headers[name.toLowerCase()] = value;
    },
    end(body = "") {
      response.payload = body;
    }
  };
  return response;
};

test("rate limiter blocks after budget is exhausted", () => {
  const limiter = new InMemoryRateLimiter(2, 60_000);
  const first = limiter.check("tenant-a", 10_000);
  const second = limiter.check("tenant-a", 10_001);
  const third = limiter.check("tenant-a", 10_002);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
});

test("parseContext reads request security headers", () => {
  const request = {
    headers: {
      "x-request-id": "req-1",
      "x-tenant-id": "tenant-starlight-health",
      "x-actor-id": "user-security",
      "x-roles": "security_admin,approver",
      "x-mtls-client-san": "spiffe://openaegis/api-gateway"
    }
  } as unknown as IncomingMessage;

  const context = parseContext(request);
  assert.equal(context.requestId, "req-1");
  assert.equal(context.tenantId, "tenant-starlight-health");
  assert.equal(context.actorId, "user-security");
  assert.deepEqual(context.roles, ["security_admin", "approver"]);
  assert.equal(context.mtlsClientSan, "spiffe://openaegis/api-gateway");
});

test("enforceSecurity denies missing required role", () => {
  const request = {
    headers: {
      "x-request-id": "req-2",
      "x-tenant-id": "tenant-starlight-health",
      "x-actor-id": "user-clinician",
      "x-roles": "workflow_operator"
    }
  } as unknown as IncomingMessage;
  const response = createMockResponse();

  const result = enforceSecurity(
    request,
    response as unknown as ServerResponse,
    {
      requireTenant: true,
      requireActor: true,
      requiredRoles: ["security_admin"]
    }
  );

  assert.equal(result, undefined);
  assert.equal(response.statusCode, 403);
  assert.match(response.payload ?? "", /insufficient_role/);
});

test("enforceRateLimit emits 429 and headers when blocked", () => {
  const response = createMockResponse();
  const allowed = enforceRateLimit(response as unknown as ServerResponse, "req-3", {
    allowed: false,
    limit: 100,
    remaining: 0,
    resetAt: 99999
  });

  assert.equal(allowed, false);
  assert.equal(response.statusCode, 429);
  assert.equal(response.headers["x-ratelimit-limit"], "100");
  assert.equal(response.headers["x-ratelimit-remaining"], "0");
  assert.match(response.payload ?? "", /rate_limit_exceeded/);
});

test("stableSerialize is deterministic and hmac helper is stable", () => {
  const valueA = { b: 2, a: { z: 9, m: [2, 1] } };
  const valueB = { a: { m: [2, 1], z: 9 }, b: 2 };
  assert.equal(stableSerialize(valueA), stableSerialize(valueB));
  assert.equal(hmacSha256("key-1", "payload"), hmacSha256("key-1", "payload"));
});
