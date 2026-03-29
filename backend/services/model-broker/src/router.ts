import type { InferenceRequest, ProviderAdapter, RouteDecision, RouteScore } from "./types.js";

const canSatisfy = (request: InferenceRequest, adapter: ProviderAdapter): boolean => {
  if (request.zeroRetentionRequired && !adapter.capabilities.supportsZeroRetention) {
    return false;
  }

  for (const capability of request.requiredCapabilities) {
    if (capability === "json_schema" && !adapter.capabilities.supportsJsonSchema) return false;
    if (capability === "tool_use" && !adapter.capabilities.supportsToolUse) return false;
    if (capability === "vision" && !adapter.capabilities.supportsVision) return false;
  }

  return true;
};

const score = (request: InferenceRequest, adapter: ProviderAdapter): RouteScore => {
  const riskPenalty = request.classification === "EPHI" && adapter.provider !== "self_hosted" ? 0.6 : 0.1;
  const latencyScore = request.maxLatencyMs <= 2000 ? 0.8 : 0.6;
  const costScore = adapter.provider === "self_hosted" ? 0.5 : 0.7;
  const riskScore = 1 - riskPenalty;
  const total = (costScore * 0.25) + (latencyScore * 0.25) + (riskScore * 0.5);
  return { cost: costScore, latency: latencyScore, risk: riskScore, total };
};

export const selectRoute = (request: InferenceRequest, adapters: ProviderAdapter[]): RouteDecision => {
  const candidates = adapters.filter((adapter) => canSatisfy(request, adapter));

  if (candidates.length === 0) {
    throw new Error("no_allowed_provider_route");
  }

  const ranked = candidates
    .map((adapter) => ({ adapter, score: score(request, adapter) }))
    .sort((a, b) => b.score.total - a.score.total);

  const winner = ranked[0]!;
  return {
    provider: winner.adapter.provider,
    modelId: winner.adapter.modelId,
    reasonCodes: ["policy_allowed", "capability_satisfied", "best_total_score"],
    score: winner.score
  };
};