import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { URL } from "node:url";
import type { ServiceDescriptor } from "@eaos/contracts";
import {
  defaultRegistryState,
  type ConnectorTrustTier,
  type ToolAction,
  type ToolManifestRecord,
  type ToolManifestStatus,
  type ToolRegistryState
} from "./manifests.js";

export const descriptor: ServiceDescriptor = {
  serviceName: "tool-registry",
  listeningPort: 3006,
  purpose: "Signed connector/tool manifest registry",
  securityTier: "regulated",
  requiresMTLS: true,
  requiresTenantContext: true,
  defaultDeny: true
};

const STATE_FILE = resolve(process.cwd(), ".volumes", "tool-registry-state.json");
const now = () => new Date().toISOString();

type JsonMap = Record<string, unknown>;

const sendJson = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

const readJson = async (request: IncomingMessage): Promise<JsonMap> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonMap;
  } catch {
    return {};
  }
};

const normalizeState = (state: Partial<ToolRegistryState> | undefined): ToolRegistryState => {
  const base = defaultRegistryState();
  return {
    version: 1,
    manifests: Array.isArray(state?.manifests) ? state.manifests : base.manifests
  };
};

const loadState = async (): Promise<ToolRegistryState> => {
  try {
    return normalizeState(JSON.parse(await readFile(STATE_FILE, "utf8")) as Partial<ToolRegistryState>);
  } catch {
    return defaultRegistryState();
  }
};

const saveState = async (state: ToolRegistryState): Promise<void> => {
  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, `${JSON.stringify(normalizeState(state), null, 2)}\n`, "utf8");
};

const toString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const toStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : undefined;

const toActionArray = (value: unknown): ToolAction[] | undefined => {
  const values = toStringArray(value);
  if (!values) return undefined;
  const allowed: ToolAction[] = [];
  for (const item of values) {
    if (item === "READ" || item === "WRITE" || item === "EXECUTE") allowed.push(item);
  }
  return allowed.length > 0 ? allowed : undefined;
};

const toTrustTier = (value: unknown): ConnectorTrustTier | undefined => {
  if (value === "tier-1" || value === "tier-2" || value === "tier-3" || value === "tier-4") return value;
  return undefined;
};

const toStatus = (value: unknown): ToolManifestStatus | undefined => {
  if (value === "draft" || value === "published") return value;
  return undefined;
};

const requireActorHeader = (request: IncomingMessage): string | undefined => {
  const actor = request.headers["x-actor-id"];
  return typeof actor === "string" && actor.trim().length > 0 ? actor : undefined;
};

const buildManifestFromRequest = (body: JsonMap, actorId: string): { manifest?: ToolManifestRecord; error?: string } => {
  const toolId = toString(body.toolId);
  const displayName = toString(body.displayName);
  const connectorType = toString(body.connectorType) as ToolManifestRecord["connectorType"] | undefined;
  const description = toString(body.description);
  const version = toString(body.version) ?? "1.0.0";
  const trustTier = toTrustTier(body.trustTier);
  const allowedActions = toActionArray(body.allowedActions);
  const permissionScopes = toStringArray(body.permissionScopes);
  const outboundDomains = toStringArray(body.outboundDomains);
  const signature = toString(body.signature);
  const signedBy = toString(body.signedBy) ?? actorId;
  const status = toStatus(body.status) ?? "draft";
  const rateLimitPerMinute = typeof body.rateLimitPerMinute === "number" ? body.rateLimitPerMinute : 60;
  const idempotent = body.idempotent !== false;
  const mockModeSupported = body.mockModeSupported !== false;

  if (!toolId || !displayName || !description || !signature || !trustTier || !allowedActions || !permissionScopes || !outboundDomains || !connectorType) {
    return { error: "invalid_manifest_payload" };
  }

  if (!["microsoft-fabric", "power-bi", "sql", "fhir", "hl7", "sharepoint", "email", "ticketing", "project"].includes(connectorType)) {
    return { error: "unsupported_connector_type" };
  }

  const timestamp = now();
  return {
    manifest: {
      toolId,
      displayName,
      connectorType,
      description,
      version,
      trustTier,
      allowedActions,
      permissionScopes,
      outboundDomains,
      rateLimitPerMinute,
      idempotent,
      mockModeSupported,
      signature,
      signedBy,
      status,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(status === "published" ? { publishedAt: timestamp } : {})
    }
  };
};

const listManifests = (manifests: ToolManifestRecord[], query: URL): ToolManifestRecord[] => {
  const status = toStatus(query.searchParams.get("status"));
  const capability = toString(query.searchParams.get("capability"));
  const trustTier = toTrustTier(query.searchParams.get("trustTier"));

  return manifests.filter((manifest) => {
    if (status && manifest.status !== status) return false;
    if (trustTier && manifest.trustTier !== trustTier) return false;
    if (capability && !manifest.permissionScopes.some((scope) => scope.includes(capability))) return false;
    return true;
  });
};

export const requestHandler = async (request: IncomingMessage, response: ServerResponse) => {
  const method = request.method ?? "GET";
  const parsedUrl = new URL(request.url ?? "/", "http://localhost");
  const pathname = parsedUrl.pathname;

  if (method === "GET" && pathname === "/healthz") {
    const state = await loadState();
    sendJson(response, 200, { status: "ok", service: descriptor.serviceName, manifests: state.manifests.length });
    return;
  }

  if (method === "GET" && pathname === "/v1/tools") {
    const state = await loadState();
    sendJson(response, 200, { manifests: listManifests(state.manifests, parsedUrl) });
    return;
  }

  if (method === "GET" && /^\/v1\/tools\/[^/]+$/.test(pathname)) {
    const toolId = pathname.split("/")[3] ?? "";
    const state = await loadState();
    const manifest = state.manifests.find((item) => item.toolId === toolId);
    if (!manifest) {
      sendJson(response, 404, { error: "tool_not_found" });
      return;
    }
    sendJson(response, 200, manifest);
    return;
  }

  if (method === "POST" && pathname === "/v1/tools") {
    const actorId = requireActorHeader(request);
    if (!actorId) {
      sendJson(response, 401, { error: "actor_header_required" });
      return;
    }

    const body = await readJson(request);
    const built = buildManifestFromRequest(body, actorId);
    if (!built.manifest) {
      sendJson(response, 400, { error: built.error ?? "invalid_manifest_payload" });
      return;
    }

    const state = await loadState();
    if (state.manifests.some((item) => item.toolId === built.manifest!.toolId)) {
      sendJson(response, 409, { error: "tool_manifest_already_exists" });
      return;
    }

    state.manifests.push(built.manifest);
    await saveState(state);
    sendJson(response, 201, built.manifest);
    return;
  }

  if (method === "POST" && /^\/v1\/tools\/[^/]+\/publish$/.test(pathname)) {
    const actorId = requireActorHeader(request);
    if (!actorId) {
      sendJson(response, 401, { error: "actor_header_required" });
      return;
    }
    const toolId = pathname.split("/")[3] ?? "";
    const body = await readJson(request);
    const signer = toString(body.signer) ?? actorId;

    const state = await loadState();
    const index = state.manifests.findIndex((item) => item.toolId === toolId);
    if (index === -1) {
      sendJson(response, 404, { error: "tool_not_found" });
      return;
    }

    const manifest = state.manifests[index]!;
    state.manifests[index] = {
      ...manifest,
      status: "published",
      signedBy: signer,
      updatedAt: now(),
      publishedAt: now()
    };
    await saveState(state);
    sendJson(response, 200, state.manifests[index]);
    return;
  }

  sendJson(response, 404, { error: "not_found", service: descriptor.serviceName, path: pathname });
};

export const createAppServer = () =>
  createServer((request, response) => {
    void requestHandler(request, response).catch((error: unknown) => {
      sendJson(response, 500, { error: "internal_error", message: error instanceof Error ? error.message : "unknown" });
    });
  });

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createAppServer();
  server.listen(descriptor.listeningPort, () => {
    console.log(descriptor.serviceName + " listening on :" + descriptor.listeningPort);
  });
}
