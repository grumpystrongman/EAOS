# notification-service

## Purpose

Approval and incident notifications

## API Contracts

- POST /v1/notifications/send
- GET /v1/notifications/{id}
- POST /v1/notifications/templates/{id}

## Main Entities

- request
- decision
- execution
- evidence

## Storage

Kafka/NATS

## Security Requirements

Signed event notifications