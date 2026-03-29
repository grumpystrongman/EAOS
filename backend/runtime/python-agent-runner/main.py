from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="EAOS Python Agent Runner", version="0.1.0")


class AgentRunRequest(BaseModel):
    execution_id: str
    mode: str = Field(pattern="^(simulation|live)$")
    max_steps: int = Field(ge=1, le=200)
    max_runtime_seconds: int = Field(ge=1, le=1800)


class AgentRunResponse(BaseModel):
    execution_id: str
    status: str
    blocked_reason: str | None = None


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/runtime/run", response_model=AgentRunResponse)
def run_agent(request: AgentRunRequest) -> AgentRunResponse:
    if request.mode == "live":
        # Live mode execution is gated by policy and approval in control plane.
        return AgentRunResponse(execution_id=request.execution_id, status="queued")
    return AgentRunResponse(execution_id=request.execution_id, status="simulated")