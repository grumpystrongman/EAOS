# secrets-broker

## Purpose

Short-lived credential leasing and rotation events

## API Contracts

- POST /v1/secrets/lease
- POST /v1/secrets/revoke/{id}
- GET /v1/secrets/leases/{id}

## Main Entities

- request
- decision
- execution
- evidence

## Storage

Postgres, KMS

## Security Requirements

Short-lived leases and least privilege