import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import type { ServiceDescriptor } from "@eaos/contracts";
import {
  applyApprovalDecision,
  buildDischargeSummary,
  createApproval,
  createAuditEvent,
  createToolCall,
  evaluatePolicy,
  loadState,
  routeModel,
  saveState,
  type ApprovalRecord,
  type PilotMode
} from "@eaos/pilot-core";

export const descriptor: ServiceDescriptor = {
  serviceName: "api-gateway",
  listeningPort: Number(process.env.PORT ?? 3000),
  purpose: "External API ingress, authn propagation, tenant and policy pre-checks",
  securityTier: "regulated",
  requiresMTLS: true,
  requiresTenantContext: true,
  defaultDeny: true
};

interface JsonMap {
  [key: string]: unknown;
}

const sendJson = (response: ServerResponse, statusCode: number, body: unknown) => {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

const readJson = async (request: IncomingMessage): Promise<JsonMap> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonMap;
  } catch {
    return {};
  }
};

const getActorFromAuthHeader = (request: IncomingMessage): string | undefined => {
  const header = request.headers.authorization;
  if (!header) return undefined;
  const parts = header.split(" ");
  if (parts.length !== 2) return undefined;
  const token = parts[1];
  if (!token) return undefined;
  if (!token.startsWith("demo-token-")) return undefined;
  return token.replace("demo-token-", "");
};

const createExecution = async (input: {
  actorId: string;
  patientId: string;
  mode: PilotMode;
  workflowId: string;
  tenantId: string;
  requestFollowupEmail: boolean;
}) => {
  const state = await loadState();
  const patient = state.fhirPatients.find((item) => item.patientId === input.patientId);
  const plan = state.carePlans.find((item) => item.patientId === input.patientId);

  if (!patient || !plan) {
    return { status: 404, body: { error: "patient_or_care_plan_not_found" } };
  }

  const policy = evaluatePolicy({
    action: "workflow.execute",
    classification: "EPHI",
    mode: input.mode,
    riskLevel: input.requestFollowupEmail ? "high" : "medium",
    zeroRetentionRequested: true
  });

  const executionId = `ex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const toolCallFhir = createToolCall({
    executionId,
    toolId: "fhir.read-patient",
    action: "READ",
    status: "completed",
    classification: "EPHI",
    resultRef: `obj://tenant-starlight-health/executions/${executionId}/fhir-patient.json`
  });
  state.toolCalls.push(toolCallFhir);

  const toolCallSql = createToolCall({
    executionId,
    toolId: "sql.read-care-plan",
    action: "READ",
    status: "completed",
    classification: "EPHI",
    resultRef: `obj://tenant-starlight-health/executions/${executionId}/care-plan.json`
  });
  state.toolCalls.push(toolCallSql);

  const modelRoute = routeModel({ classification: "EPHI", zeroRetentionRequired: true });
  const output = buildDischargeSummary(patient, plan);

  let status: "blocked" | "completed" = "completed";
  let blockedReason: string | undefined;
  let approvalId: string | undefined;

  if (policy.effect === "REQUIRE_APPROVAL" && input.mode === "live") {
    const approval = createApproval({
      tenantId: input.tenantId,
      requestedBy: input.actorId,
      reason: "Send discharge follow-up email",
      riskLevel: "high",
      executionId
    });
    state.approvals.push(approval);
    approvalId = approval.approvalId;
    status = "blocked";
    blockedReason = "approval_required_before_followup_email";
  }

  const execution: {
    executionId: string;
    workflowId: string;
    mode: PilotMode;
    tenantId: string;
    actorId: string;
    patientId: string;
    status: "blocked" | "completed";
    currentStep: string;
    output: { summary: string; recommendation: string; riskFlags: string[] };
    blockedReason?: string;
    approvalId?: string;
    modelRoute: ReturnType<typeof routeModel>;
    toolCalls: string[];
    evidenceId: string;
    createdAt: string;
    updatedAt: string;
  } = {
    executionId,
    workflowId: input.workflowId,
    mode: input.mode,
    tenantId: input.tenantId,
    actorId: input.actorId,
    patientId: input.patientId,
    status,
    currentStep: status === "completed" ? "done" : "awaiting_approval",
    output,
    modelRoute,
    toolCalls: [toolCallFhir.toolCallId, toolCallSql.toolCallId],
    evidenceId: `ev-${executionId}`,
    createdAt: now,
    updatedAt: now
  };
  if (blockedReason) {
    execution.blockedReason = blockedReason;
  }
  if (approvalId) {
    execution.approvalId = approvalId;
  }

  state.executions.push(execution);

  state.auditEvents.push(
    createAuditEvent({
      tenantId: input.tenantId,
      actorId: input.actorId,
      category: "workflow",
      action: "execution_created",
      status: status === "completed" ? "success" : "blocked",
      details: {
        executionId,
        workflowId: input.workflowId,
        policyDecision: policy,
        approvalId,
        mode: input.mode
      }
    })
  );

  await saveState(state);
  return { status: 201, body: execution };
};

const handleApprove = async (approvalId: string, actorId: string, body: JsonMap) => {
  const state = await loadState();
  const approval = state.approvals.find((item) => item.approvalId === approvalId);
  if (!approval) {
    return { status: 404, body: { error: "approval_not_found" } };
  }

  const decision = (body.decision === "approve" ? "approved" : "rejected") as "approved" | "rejected";
  const updated = applyApprovalDecision(approval, {
    approverId: actorId,
    decision,
    ...(typeof body.reason === "string" ? { reason: body.reason } : {})
  });

  const index = state.approvals.findIndex((item) => item.approvalId === approvalId);
  state.approvals[index] = updated;

  if (updated.status === "approved" && updated.executionId) {
    const execution = state.executions.find((item) => item.executionId === updated.executionId);
    if (execution && execution.status === "blocked") {
      const toolCall = createToolCall({
        executionId: execution.executionId,
        toolId: "email.send-followup",
        action: "EXECUTE",
        status: "completed",
        classification: "PII",
        resultRef: `obj://tenant-starlight-health/executions/${execution.executionId}/followup-email.json`
      });
      state.toolCalls.push(toolCall);
      execution.toolCalls.push(toolCall.toolCallId);
      execution.status = "completed";
      execution.currentStep = "done";
      delete execution.blockedReason;
      execution.updatedAt = new Date().toISOString();
    }
  }

  state.auditEvents.push(
    createAuditEvent({
      tenantId: updated.tenantId,
      actorId,
      category: "approval",
      action: "approval_decided",
      status: updated.status === "rejected" ? "blocked" : "success",
      details: {
        approvalId: updated.approvalId,
        executionId: updated.executionId,
        decision: updated.status
      }
    })
  );

  await saveState(state);
  return { status: 200, body: updated };
};

export const requestHandler = async (request: IncomingMessage, response: ServerResponse) => {
  const method = request.method ?? "GET";
  const parsedUrl = new URL(request.url ?? "/", "http://localhost");
  const pathname = parsedUrl.pathname;

  if (pathname === "/healthz") {
    sendJson(response, 200, { status: "ok", service: descriptor.serviceName });
    return;
  }

  if (method === "POST" && pathname === "/v1/auth/login") {
    const body = await readJson(request);
    const email = typeof body.email === "string" ? body.email : "";
    const state = await loadState();
    const user = state.users.find((item) => item.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      sendJson(response, 401, { error: "invalid_credentials" });
      return;
    }

    sendJson(response, 200, {
      accessToken: `demo-token-${user.userId}`,
      user,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    });
    return;
  }

  const actorId = getActorFromAuthHeader(request);
  if (!actorId) {
    sendJson(response, 401, { error: "missing_or_invalid_auth_token" });
    return;
  }

  if (method === "POST" && pathname === "/v1/policy/evaluate") {
    const body = await readJson(request);
    const result = evaluatePolicy({
      action: typeof body.action === "string" ? body.action : "unknown",
      classification: (body.classification as "EPHI") ?? "EPHI",
      riskLevel: (body.riskLevel as "low" | "medium" | "high" | "critical") ?? "low",
      mode: (body.mode as PilotMode) ?? "simulation",
      zeroRetentionRequested: body.zeroRetentionRequested === true
    });
    sendJson(response, 200, result);
    return;
  }

  if (method === "POST" && pathname === "/v1/approvals") {
    const body = await readJson(request);
    const state = await loadState();
    const approval = createApproval({
      tenantId: typeof body.tenantId === "string" ? body.tenantId : "tenant-starlight-health",
      requestedBy: actorId,
      reason: typeof body.reason === "string" ? body.reason : "manual_approval",
      riskLevel: (body.riskLevel as "high" | "critical") ?? "high",
      ...(typeof body.executionId === "string" ? { executionId: body.executionId } : {})
    });
    state.approvals.push(approval);
    await saveState(state);
    sendJson(response, 201, approval);
    return;
  }

  if (method === "GET" && pathname === "/v1/approvals") {
    const state = await loadState();
    sendJson(response, 200, { approvals: state.approvals });
    return;
  }

  if (method === "POST" && /^\/v1\/approvals\/.+\/decide$/.test(pathname)) {
    const body = await readJson(request);
    const approvalId = pathname.split("/")[3] ?? "";
    const result = await handleApprove(approvalId, actorId, body);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === "POST" && pathname === "/v1/model/route/preview") {
    const body = await readJson(request);
    const decision = routeModel({
      classification: (body.classification as "EPHI") ?? "EPHI",
      zeroRetentionRequired: body.zeroRetentionRequired !== false
    });
    sendJson(response, 200, { selected: decision, fallback: [{ provider: "anthropic", modelId: "claude-3.5-sonnet", zeroRetention: true }] });
    return;
  }

  if (method === "POST" && /^\/v1\/tools\/.+\/(simulate|execute)$/.test(pathname)) {
    const body = await readJson(request);
    const mode = pathname.endsWith("/simulate") ? "simulate" : "execute";
    const toolId = pathname.split("/")[3] ?? "unknown-tool";
    const result = {
      toolCallId: `tc-${Date.now().toString(36)}`,
      toolId,
      mode,
      status: "completed",
      result: {
        echoedParameters: body,
        note: "Tool execution is sandboxed and audited in pilot mode."
      }
    };
    sendJson(response, 200, result);
    return;
  }

  if (method === "POST" && pathname === "/v1/executions") {
    const body = await readJson(request);
    const result = await createExecution({
      actorId,
      patientId: typeof body.patientId === "string" ? body.patientId : "patient-1001",
      mode: (body.mode as PilotMode) ?? "simulation",
      workflowId: typeof body.workflowId === "string" ? body.workflowId : "wf-discharge-assistant",
      tenantId: typeof body.tenantId === "string" ? body.tenantId : "tenant-starlight-health",
      requestFollowupEmail: body.requestFollowupEmail !== false
    });
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === "GET" && /^\/v1\/executions\/.+$/.test(pathname)) {
    const executionId = pathname.split("/")[3] ?? "";
    const state = await loadState();
    const execution = state.executions.find((item) => item.executionId === executionId);
    if (!execution) {
      sendJson(response, 404, { error: "execution_not_found" });
      return;
    }
    sendJson(response, 200, execution);
    return;
  }

  if (method === "GET" && pathname === "/v1/audit/events") {
    const state = await loadState();
    sendJson(response, 200, { events: state.auditEvents.slice().reverse() });
    return;
  }

  if (method === "GET" && /^\/v1\/audit\/evidence\/.+$/.test(pathname)) {
    const evidenceId = pathname.split("/")[4] ?? "";
    const state = await loadState();
    const event = state.auditEvents.find((item) => item.evidenceId === evidenceId);
    if (!event) {
      sendJson(response, 404, { error: "evidence_not_found" });
      return;
    }
    sendJson(response, 200, { evidence: event });
    return;
  }

  sendJson(response, 404, { error: "not_found", path: pathname });
};

export const createAppServer = () => createServer((request, response) => {
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
