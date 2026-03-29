# api-gateway

## Purpose

External API ingress, authn propagation, tenant and policy pre-checks

## API Contracts

- POST /v1/workflows/{id}/execute
- POST /v1/agents/{id}/simulate
- GET /v1/health

## Main Entities

- request
- decision
- execution
- evidence

## Storage

Redis, Postgres

## Security Requirements

JWT validation, tenant binding, rate limits