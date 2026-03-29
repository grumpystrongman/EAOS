# tenant-service

## Purpose

Tenant lifecycle and isolation guardrails

## API Contracts

- POST /v1/tenants
- GET /v1/tenants/{id}
- POST /v1/tenants/{id}/isolation-check

## Main Entities

- request
- decision
- execution
- evidence

## Storage

Postgres

## Security Requirements

Strict tenant isolation checks