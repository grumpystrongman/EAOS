export type ExecutionState = "queued" | "running" | "blocked" | "completed" | "failed" | "killed";

export interface StepCheckpoint {
  executionId: string;
  stepNumber: number;
  stateHash: string;
  createdAt: string;
}

export interface ExecutionContext {
  executionId: string;
  state: ExecutionState;
  stepBudgetRemaining: number;
  retryBudgetRemaining: number;
  checkpoints: StepCheckpoint[];
}

export const transitionExecution = (
  context: ExecutionContext,
  event: "start" | "step_succeeded" | "step_failed" | "blocked" | "kill" | "complete"
): ExecutionContext => {
  if (event === "start" && context.state === "queued") {
    return { ...context, state: "running" };
  }

  if (event === "blocked") {
    return { ...context, state: "blocked" };
  }

  if (event === "kill") {
    return { ...context, state: "killed" };
  }

  if (event === "complete") {
    return { ...context, state: "completed" };
  }

  if (event === "step_failed") {
    const retries = context.retryBudgetRemaining - 1;
    return { ...context, retryBudgetRemaining: retries, state: retries >= 0 ? "running" : "failed" };
  }

  return context;
};