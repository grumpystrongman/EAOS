export type ModelProvider = "openai" | "anthropic" | "google" | "azure" | "self_hosted";

export interface ProviderCapability {
  supportsJsonSchema: boolean;
  supportsToolUse: boolean;
  supportsVision: boolean;
  supportsZeroRetention: boolean;
  maxContextTokens: number;
}

export interface ProviderAdapter {
  provider: ModelProvider;
  modelId: string;
  capabilities: ProviderCapability;
  infer(request: InferenceRequest): Promise<InferenceResult>;
}

export interface InferenceRequest {
  requestId: string;
  tenantId: string;
  classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "PII" | "PHI" | "EPHI" | "SECRET";
  requiredCapabilities: Array<"json_schema" | "tool_use" | "vision" | "streaming">;
  zeroRetentionRequired: boolean;
  maxLatencyMs: number;
}

export interface RouteScore {
  cost: number;
  latency: number;
  risk: number;
  total: number;
}

export interface RouteDecision {
  provider: ModelProvider;
  modelId: string;
  reasonCodes: string[];
  score: RouteScore;
}

export interface InferenceResult {
  responseId: string;
  outputRef: string;
  tokenUsage: {
    prompt: number;
    completion: number;
  };
}