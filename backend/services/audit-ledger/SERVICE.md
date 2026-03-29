# audit-ledger

## Purpose

Immutable evidence ledger and replay index

## API Contracts

- POST /v1/audit/events
- GET /v1/audit/evidence/{id}
- POST /v1/audit/replay/{executionId}

## Main Entities

- request
- decision
- execution
- evidence

## Storage

Postgres, object storage

## Security Requirements

Append-only hash chained evidence