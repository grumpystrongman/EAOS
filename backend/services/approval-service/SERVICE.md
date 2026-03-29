# approval-service

## Purpose

Human approvals, escalation and dual-control

## API Contracts

- POST /v1/approvals
- POST /v1/approvals/{id}/decide
- GET /v1/approvals/{id}

## Main Entities

- request
- decision
- execution
- evidence

## Storage

Postgres, Kafka/NATS

## Security Requirements

Dual-control and anti-replay decision records