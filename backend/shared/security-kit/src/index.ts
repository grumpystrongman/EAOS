import { createHash, createHmac, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface JsonMap {
  [key: string]: unknown;
}

export interface RequestContext {
  requestId: string;
  tenantId?: string | undefined;
  actorId?: string | undefined;
  roles: string[];
  mtlsClientSan?: string | undefined;
  mtlsVerified: boolean;
  internalContextVerified: boolean;
  internalContextError?: string | undefined;
}

export interface SecurityRequirements {
  requireTenant?: boolean;
  requireActor?: boolean;
  requireMtls?: boolean;
  requiredRoles?: string[];
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

interface SignedInternalContextPayload {
  v: 1;
  requestId?: string;
  tenantId?: string;
  actorId?: string;
  roles?: string[];
  mtlsClientSan?: string;
  mtlsVerified?: boolean;
  issuedAt: number;
}

interface SignedInternalContextVerification {
  verified: boolean;
  payload?: SignedInternalContextPayload;
  error?: string;
}

export interface SignedInternalContextInput {
  requestId?: string;
  tenantId?: string;
  actorId?: string;
  roles?: string[];
  mtlsClientSan?: string;
  mtlsVerified?: boolean;
}

const internalContextHeader = "x-openaegis-internal-context";
const internalContextSignatureHeader = "x-openaegis-internal-context-signature";
const defaultInternalContextMaxAgeMs = 5 * 60 * 1000;

export class InMemoryRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();
  private readonly maxPerWindow: number;
  private readonly windowMs: number;

  constructor(maxPerWindow: number, windowMs: number) {
    this.maxPerWindow = maxPerWindow;
    this.windowMs = windowMs;
  }

  check(key: string, nowMs = Date.now()): RateLimitResult {
    const current = this.windows.get(key);
    if (!current || current.resetAt <= nowMs) {
      const resetAt = nowMs + this.windowMs;
      this.windows.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        limit: this.maxPerWindow,
        remaining: this.maxPerWindow - 1,
        resetAt
      };
    }

    if (current.count >= this.maxPerWindow) {
      return {
        allowed: false,
        limit: this.maxPerWindow,
        remaining: 0,
        resetAt: current.resetAt
      };
    }

    current.count += 1;
    return {
      allowed: true,
      limit: this.maxPerWindow,
      remaining: this.maxPerWindow - current.count,
      resetAt: current.resetAt
    };
  }
}

export const sendJson = (response: ServerResponse, statusCode: number, body: unknown, requestId?: string) => {
  response.writeHead(statusCode, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    ...(requestId ? { "x-request-id": requestId } : {})
  });
  response.end(JSON.stringify(body));
};

export const readJson = async (request: IncomingMessage, maxBytes = 1024 * 1024): Promise<JsonMap> => {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      throw new Error("payload_too_large");
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonMap;
  } catch {
    return {};
  }
};

const getInternalContextRequirement = (): boolean => {
  if (process.env.OPENAEGIS_REQUIRE_SIGNED_INTERNAL_CONTEXT === "true") return true;
  return process.env.NODE_ENV === "production" && process.env.OPENAEGIS_ALLOW_UNSIGNED_INTERNAL_CONTEXT_IN_PRODUCTION !== "true";
};

const getInternalContextSigningKey = (): string | undefined => {
  const value = process.env.OPENAEGIS_INTERNAL_CONTEXT_SIGNING_KEY;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

const getInternalContextMaxAgeMs = (): number => {
  const configured = Number(process.env.OPENAEGIS_INTERNAL_CONTEXT_MAX_AGE_MS ?? defaultInternalContextMaxAgeMs);
  return Number.isFinite(configured) && configured > 0 ? configured : defaultInternalContextMaxAgeMs;
};

const parseSignedInternalContextPayload = (encoded: string): SignedInternalContextPayload | undefined => {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<SignedInternalContextPayload>;
    if (parsed.v !== 1 || typeof parsed.issuedAt !== "number" || !Number.isFinite(parsed.issuedAt)) {
      return undefined;
    }
    if (parsed.roles && (!Array.isArray(parsed.roles) || parsed.roles.some((role) => typeof role !== "string"))) {
      return undefined;
    }
    return {
      v: 1,
      issuedAt: parsed.issuedAt,
      ...(typeof parsed.requestId === "string" && parsed.requestId.trim().length > 0 ? { requestId: parsed.requestId.trim() } : {}),
      ...(typeof parsed.tenantId === "string" && parsed.tenantId.trim().length > 0 ? { tenantId: parsed.tenantId.trim() } : {}),
      ...(typeof parsed.actorId === "string" && parsed.actorId.trim().length > 0 ? { actorId: parsed.actorId.trim() } : {}),
      ...(Array.isArray(parsed.roles)
        ? {
            roles: parsed.roles
              .map((role) => role.trim())
              .filter((role) => role.length > 0)
          }
        : {}),
      ...(typeof parsed.mtlsClientSan === "string" && parsed.mtlsClientSan.trim().length > 0
        ? { mtlsClientSan: parsed.mtlsClientSan.trim() }
        : {}),
      ...(typeof parsed.mtlsVerified === "boolean" ? { mtlsVerified: parsed.mtlsVerified } : {})
    };
  } catch {
    return undefined;
  }
};

const verifySignedInternalContext = (request: IncomingMessage): SignedInternalContextVerification => {
  const encodedHeader = request.headers[internalContextHeader];
  const signatureHeader = request.headers[internalContextSignatureHeader];
  const encoded = typeof encodedHeader === "string" && encodedHeader.trim().length > 0 ? encodedHeader.trim() : undefined;
  const signature = typeof signatureHeader === "string" && signatureHeader.trim().length > 0 ? signatureHeader.trim() : undefined;

  if (!encoded && !signature) return { verified: false };
  if (!encoded || !signature) {
    return { verified: false, error: "internal_context_signature_missing" };
  }

  const signingKey = getInternalContextSigningKey();
  if (!signingKey) {
    return { verified: false, error: "internal_context_signing_key_missing" };
  }

  const expectedSignature = hmacSha256(signingKey, encoded);
  if (expectedSignature !== signature) {
    return { verified: false, error: "internal_context_signature_invalid" };
  }

  const payload = parseSignedInternalContextPayload(encoded);
  if (!payload) {
    return { verified: false, error: "internal_context_payload_invalid" };
  }

  const maxAgeMs = getInternalContextMaxAgeMs();
  if (Math.abs(Date.now() - payload.issuedAt) > maxAgeMs) {
    return { verified: false, error: "internal_context_signature_expired" };
  }

  return { verified: true, payload };
};

export const createSignedInternalContextHeaders = (
  input: SignedInternalContextInput,
  options?: { signingKey?: string; nowMs?: number }
): Record<string, string> => {
  const signingKey = options?.signingKey ?? getInternalContextSigningKey();
  if (!signingKey) {
    throw new Error("internal_context_signing_key_missing");
  }

  const payload: SignedInternalContextPayload = {
    v: 1,
    issuedAt: options?.nowMs ?? Date.now(),
    ...(typeof input.requestId === "string" && input.requestId.trim().length > 0 ? { requestId: input.requestId.trim() } : {}),
    ...(typeof input.tenantId === "string" && input.tenantId.trim().length > 0 ? { tenantId: input.tenantId.trim() } : {}),
    ...(typeof input.actorId === "string" && input.actorId.trim().length > 0 ? { actorId: input.actorId.trim() } : {}),
    ...(Array.isArray(input.roles)
      ? {
          roles: Array.from(
            new Set(input.roles.map((role) => role.trim()).filter((role) => role.length > 0))
          ).sort()
        }
      : {}),
    ...(typeof input.mtlsClientSan === "string" && input.mtlsClientSan.trim().length > 0
      ? { mtlsClientSan: input.mtlsClientSan.trim() }
      : {}),
    ...(typeof input.mtlsVerified === "boolean" ? { mtlsVerified: input.mtlsVerified } : {})
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return {
    [internalContextHeader]: encoded,
    [internalContextSignatureHeader]: hmacSha256(signingKey, encoded)
  };
};

export const parseContext = (request: IncomingMessage): RequestContext => {
  const signedContext = verifySignedInternalContext(request);
  const requestId =
    signedContext.payload?.requestId ??
    (typeof request.headers["x-request-id"] === "string" && request.headers["x-request-id"].length > 0
      ? request.headers["x-request-id"]
      : randomUUID());
  const tenantId =
    signedContext.payload?.tenantId ??
    (typeof request.headers["x-tenant-id"] === "string" && request.headers["x-tenant-id"].trim().length > 0
      ? request.headers["x-tenant-id"].trim()
      : undefined);
  const actorId =
    signedContext.payload?.actorId ??
    (typeof request.headers["x-actor-id"] === "string" && request.headers["x-actor-id"].trim().length > 0
      ? request.headers["x-actor-id"].trim()
      : undefined);
  const roles =
    signedContext.payload?.roles ??
    (typeof request.headers["x-roles"] === "string"
      ? request.headers["x-roles"].split(",").map((item) => item.trim()).filter((item) => item.length > 0)
      : []);
  const mtlsClientSan =
    signedContext.payload?.mtlsClientSan ??
    (typeof request.headers["x-mtls-client-san"] === "string" && request.headers["x-mtls-client-san"].trim().length > 0
      ? request.headers["x-mtls-client-san"].trim()
      : undefined);
  const mtlsVerifiedRaw =
    typeof request.headers["x-mtls-verified"] === "string" ? request.headers["x-mtls-verified"].trim().toLowerCase() : "";
  const mtlsVerified =
    signedContext.payload?.mtlsVerified ??
    (mtlsVerifiedRaw === "true" || mtlsVerifiedRaw === "1" || mtlsVerifiedRaw === "verified");

  return {
    requestId,
    tenantId,
    actorId,
    roles,
    mtlsClientSan,
    mtlsVerified,
    internalContextVerified: signedContext.verified,
    ...(signedContext.error ? { internalContextError: signedContext.error } : {})
  };
};

export const enforceSecurity = (
  request: IncomingMessage,
  response: ServerResponse,
  requirements: SecurityRequirements,
  context = parseContext(request)
): RequestContext | undefined => {
  const enforceMtls = requirements.requireMtls || process.env.OPENAEGIS_ENFORCE_MTLS === "true";
  const requireSignedInternalContext = getInternalContextRequirement();

  if (context.internalContextError) {
    if (context.internalContextError === "internal_context_signing_key_missing" && requireSignedInternalContext) {
      sendJson(response, 503, { error: "internal_context_signing_key_not_configured" }, context.requestId);
      return undefined;
    }
    sendJson(response, 401, { error: context.internalContextError }, context.requestId);
    return undefined;
  }

  if (requireSignedInternalContext && !context.internalContextVerified) {
    if (!getInternalContextSigningKey()) {
      sendJson(response, 503, { error: "internal_context_signing_key_not_configured" }, context.requestId);
      return undefined;
    }
    sendJson(response, 401, { error: "internal_context_signature_required" }, context.requestId);
    return undefined;
  }

  if (requirements.requireTenant && !context.tenantId) {
    sendJson(response, 400, { error: "tenant_context_required" }, context.requestId);
    return undefined;
  }

  if (requirements.requireActor && !context.actorId) {
    sendJson(response, 401, { error: "actor_context_required" }, context.requestId);
    return undefined;
  }

  if (enforceMtls) {
    const trustProxyHeaders = process.env.OPENAEGIS_TRUST_PROXY_MTLS_HEADERS === "true";
    if (!trustProxyHeaders) {
      sendJson(response, 503, { error: "mtls_proxy_attestation_not_configured" }, context.requestId);
      return undefined;
    }
    if (!context.mtlsVerified) {
      sendJson(response, 401, { error: "mtls_attestation_unverified" }, context.requestId);
      return undefined;
    }
  }

  if (enforceMtls && !context.mtlsClientSan) {
    sendJson(response, 401, { error: "mtls_attestation_required" }, context.requestId);
    return undefined;
  }

  if (requirements.requiredRoles && requirements.requiredRoles.length > 0) {
    const hasRole = requirements.requiredRoles.some((role) => context.roles.includes(role));
    if (!hasRole) {
      sendJson(response, 403, { error: "insufficient_role" }, context.requestId);
      return undefined;
    }
  }

  return context;
};

export const enforceRateLimit = (
  response: ServerResponse,
  requestId: string,
  result: RateLimitResult
): boolean => {
  response.setHeader("x-ratelimit-limit", String(result.limit));
  response.setHeader("x-ratelimit-remaining", String(result.remaining));
  response.setHeader("x-ratelimit-reset", String(result.resetAt));
  if (!result.allowed) {
    sendJson(response, 429, { error: "rate_limit_exceeded" }, requestId);
    return false;
  }
  return true;
};

export const sha256Hex = (value: string): string => createHash("sha256").update(value).digest("hex");

export const stableSerialize = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
    .join(",")}}`;
};

export const hmacSha256 = (key: string, payload: string): string =>
  createHmac("sha256", key).update(payload).digest("base64url");

export const nowIso = () => new Date().toISOString();
