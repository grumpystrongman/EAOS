# tool-execution-service

## Purpose

Sandboxed tool dispatch and evidence collection

## API Contracts

- GET /healthz
- GET /v1/tool-calls
- GET /v1/tool-calls/{toolCallId}
- POST /v1/tool-calls

## Main Entities

- tool call
- runtime guard decision
- idempotency replay
- execution result envelope

## Storage

`.volumes/tool-execution-state.json` for the pilot (replace with queue + durable storage in production)

## Security Requirements

- Sandboxing, deny-by-default egress
- Runtime guard enforcement for action, network profile, step budget, and approval obligations
- Idempotency-key replay protection for safe retries
