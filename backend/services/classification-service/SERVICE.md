# classification-service

## Purpose

PHI/PII/DLP classification and redaction

## API Contracts

- POST /v1/classification/scan
- POST /v1/classification/redact
- GET /v1/classification/rules

## Main Entities

- request
- decision
- execution
- evidence

## Storage

Postgres

## Security Requirements

PHI/PII DLP scanning and redaction