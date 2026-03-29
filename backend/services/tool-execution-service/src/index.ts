import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { URL } from "node:url";
import type { ServiceDescriptor } from "@eaos/contracts";
import { enforceToolCallGuard, type ToolManifest } from "./runtime-policy.js";

export const descriptor: ServiceDescriptor = {
  serviceName: "tool-execution-service",
  listeningPort: 3007,
  purpose: "Sandboxed tool dispatch and evidence collection",
  securityTier: "regulated",
  requiresMTLS: true,
  requiresTenantContext: true,
  defaultDeny: true
};

type ToolAction = "READ" | "WRITE" | "EXECUTE";
type RunMode = "simulate" | "execute";

interface ToolCallRecord {
  toolCallId: string;
  toolId: string;
  mode: RunMode;
  action: ToolAction;
  requestedNetworkProfile: string;
  actorId: string;
  tenantId: string;
  idempotencyKey?: string;
  status: "completed" | "blocked";
  guardReason?: string;
  parameters: Record<string, unknown>;
  result: Record<string, unknown>;
  createdAt: string;
}

interface ExecutionState {
  version: number;
  calls: ToolCallRecord[];
}

const stateFile = resolve(process.cwd(), ".volumes", "tool-execution-state.json");
const now = () => new Date().toISOString();

const runtimeManifests: ToolManifest[] = [
  {
    toolId: "connector-fhir-read",
    version: "1.0.0",
    signature: "sig-fhir-v1",
    allowedActions: ["READ"],
    networkProfiles: ["clinical-internal"]
  },
  {
    toolId: "connector-sql-careplan",
    version: "1.0.0",
    signature: "sig-sql-v1",
    allowedActions: ["READ"],
    networkProfiles: ["clinical-internal"]
  },
  {
    toolId: "connector-email-notify",
    version: "1.0.0",
    signature: "sig-email-v1",
    allowedActions: ["EXECUTE"],
    networkProfiles: ["outbound-approved"]
  },
  {
    toolId: "connector-linear-project",
    version: "1.0.0",
    signature: "sig-linear-v1",
    allowedActions: ["READ", "WRITE", "EXECUTE"],
    networkProfiles: ["project-ops"]
  }
];

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

const loadState = async (): Promise<ExecutionState> => {
  try {
    const parsed = JSON.parse(await readFile(stateFile, "utf8")) as Partial<ExecutionState>;
    return {
      version: 1,
      calls: Array.isArray(parsed.calls) ? parsed.calls : []
    };
  } catch {
    return { version: 1, calls: [] };
  }
};

const saveState = async (state: ExecutionState): Promise<void> => {
  await mkdir(dirname(stateFile), { recursive: true });
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
};

const toString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const toAction = (value: unknown): ToolAction | undefined => {
  if (value === "READ" || value === "WRITE" || value === "EXECUTE") return value;
  return undefined;
};

const toMode = (value: unknown): RunMode => (value === "execute" ? "execute" : "simulate");

const getManifest = (toolId: string): ToolManifest | undefined =>
  runtimeManifests.find((manifest) => manifest.toolId === toolId);

const buildResult = (toolId: string, mode: RunMode, parameters: Record<string, unknown>) => {
  if (toolId === "connector-linear-project") {
    return {
      operation: mode === "simulate" ? "mock_linear_issue_write" : "linear_issue_write",
      output: {
        issueKey: `LIN-${Math.floor(Math.random() * 900 + 100)}`,
        status: "created",
        tags: ["eaos", "connector", "audit"]
      },
      echoedParameters: parameters
    };
  }

  return {
    operation: mode === "simulate" ? "mock_execution" : "live_execution",
    output: {
      summary: `Tool ${toolId} ${mode === "simulate" ? "simulated" : "executed"} successfully`
    },
    echoedParameters: parameters
  };
};

const buildCallId = () => `tc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const requestHandler = async (request: IncomingMessage, response: ServerResponse) => {
  const method = request.method ?? "GET";
  const parsed = new URL(request.url ?? "/", "http://localhost");
  const pathname = parsed.pathname;

  if (method === "GET" && pathname === "/healthz") {
    const state = await loadState();
    sendJson(response, 200, { status: "ok", service: descriptor.serviceName, calls: state.calls.length });
    return;
  }

  if (method === "GET" && pathname === "/v1/tool-calls") {
    const state = await loadState();
    sendJson(response, 200, { calls: state.calls.slice().reverse() });
    return;
  }

  if (method === "GET" && /^\/v1\/tool-calls\/[^/]+$/.test(pathname)) {
    const callId = pathname.split("/")[3] ?? "";
    const state = await loadState();
    const call = state.calls.find((item) => item.toolCallId === callId);
    if (!call) {
      sendJson(response, 404, { error: "tool_call_not_found" });
      return;
    }
    sendJson(response, 200, call);
    return;
  }

  if (method === "POST" && pathname === "/v1/tool-calls") {
    const body = await readJson(request);
    const toolId = toString(body.toolId);
    const action = toAction(body.action);
    const mode = toMode(body.mode);
    const requestedNetworkProfile = toString(body.requestedNetworkProfile) ?? "clinical-internal";
    const actorId = toString(request.headers["x-actor-id"]) ?? "system-actor";
    const tenantId = toString(request.headers["x-tenant-id"]) ?? "tenant-starlight-health";
    const idempotencyKey = toString(request.headers["idempotency-key"]) ?? toString(body.idempotencyKey);
    const stepBudgetRemaining = typeof body.stepBudgetRemaining === "number" ? body.stepBudgetRemaining : 1;
    const requiresApproval = body.requiresApproval === true;
    const approvalGranted = body.approvalGranted === true;
    const parameters = (typeof body.parameters === "object" && body.parameters !== null
      ? body.parameters
      : {}) as Record<string, unknown>;

    if (!toolId || !action) {
      sendJson(response, 400, { error: "tool_id_and_action_required" });
      return;
    }

    const manifest = getManifest(toolId);
    if (!manifest) {
      sendJson(response, 404, { error: "tool_manifest_not_found" });
      return;
    }

    const state = await loadState();
    if (idempotencyKey) {
      const existing = state.calls.find((call) => call.idempotencyKey === idempotencyKey && call.toolId === toolId && call.action === action);
      if (existing) {
        sendJson(response, 200, { ...existing, idempotentReplay: true });
        return;
      }
    }

    const guard = enforceToolCallGuard(manifest, {
      action,
      requestedNetworkProfile,
      stepBudgetRemaining,
      requiresApproval,
      approvalGranted
    });

    if (!guard.allowed) {
      const blocked: ToolCallRecord = {
        toolCallId: buildCallId(),
        toolId,
        mode,
        action,
        requestedNetworkProfile,
        actorId,
        tenantId,
        ...(idempotencyKey ? { idempotencyKey } : {}),
        status: "blocked",
        guardReason: guard.reason ?? "blocked",
        parameters,
        result: { blocked: true },
        createdAt: now()
      };
      state.calls.push(blocked);
      await saveState(state);
      sendJson(response, 403, blocked);
      return;
    }

    const completed: ToolCallRecord = {
      toolCallId: buildCallId(),
      toolId,
      mode,
      action,
      requestedNetworkProfile,
      actorId,
      tenantId,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      status: "completed",
      parameters,
      result: buildResult(toolId, mode, parameters),
      createdAt: now()
    };

    state.calls.push(completed);
    await saveState(state);
    sendJson(response, 200, completed);
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
