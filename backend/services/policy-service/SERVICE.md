# policy-service

## Purpose

OPA/Cedar policy evaluation and decision logs

## API Contracts

- POST /v1/policy/evaluate
- POST /v1/policy/bundles/{id}/publish
- GET /v1/policy/decisions/{id}

## Main Entities

- request
- decision
- execution
- evidence

## Storage

Postgres, object storage for bundles

## Security Requirements

Fail-closed policy evaluation, signed bundles