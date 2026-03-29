# agent-registry

## Purpose

Agent definitions, versions, and signing metadata

## API Contracts

- POST /v1/agents
- GET /v1/agents/{id}
- POST /v1/agents/{id}/publish

## Main Entities

- request
- decision
- execution
- evidence

## Storage

Postgres

## Security Requirements

Signed manifests and provenance