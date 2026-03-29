# tool-registry

## Purpose

Signed connector/tool manifest registry

## API Contracts

- POST /v1/tools
- GET /v1/tools/{id}
- POST /v1/tools/{id}/publish

## Main Entities

- request
- decision
- execution
- evidence

## Storage

Postgres

## Security Requirements

Signed tool definitions and scope validation