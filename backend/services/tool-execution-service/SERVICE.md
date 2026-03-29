# tool-execution-service

## Purpose

Sandboxed tool dispatch and evidence collection

## API Contracts

- POST /v1/tools/{id}/execute
- POST /v1/tools/{id}/simulate
- GET /v1/tool-calls/{id}

## Main Entities

- request
- decision
- execution
- evidence

## Storage

Object storage, Kafka/NATS

## Security Requirements

Sandboxing, deny-by-default egress