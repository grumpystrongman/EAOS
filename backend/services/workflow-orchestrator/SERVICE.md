# workflow-orchestrator

## Purpose

Deterministic workflow state machine and checkpointing

## API Contracts

- POST /v1/executions
- GET /v1/executions/{id}
- POST /v1/executions/{id}/cancel

## Main Entities

- request
- decision
- execution
- evidence

## Storage

Postgres, Kafka/NATS, Redis

## Security Requirements

Deterministic idempotent execution, approval gating