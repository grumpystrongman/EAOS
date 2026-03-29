# observability-service

## Purpose

OTel ingestion and SLO analytics

## API Contracts

- POST /v1/otel/ingest
- GET /v1/metrics/query
- GET /v1/traces/{traceId}

## Main Entities

- request
- decision
- execution
- evidence

## Storage

Metrics backend, object storage

## Security Requirements

Sensitive field scrubbing and access controls