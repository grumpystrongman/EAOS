# model-broker

## Purpose

Vendor-neutral model routing and adapter dispatch

## API Contracts

- GET /healthz
- GET /v1/model-broker/providers/capabilities
- POST /v1/model-broker/providers
- POST /v1/model-broker/routes/evaluate
- GET /v1/model-broker/routes/decisions

## Main Entities

- provider capability profile
- route input
- route decision
- blocked candidate reason codes
- route score + reason codes

## Storage

`.volumes/model-broker-state.json` for the pilot (replace with Postgres/Kafka in production)

## Security Requirements

- Sensitivity-aware routing and zero-retention enforcement
- Secret workloads forced to self-hosted routes
- Capability + cost + latency + risk gating with explicit reason codes
- Provider metadata exposes deployment/auth/retention posture for policy decisions
