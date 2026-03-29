# context-retrieval-service

## Purpose

Classified retrieval and context assembly

## API Contracts

- POST /v1/context/query
- POST /v1/context/chunks
- GET /v1/context/chunks/{id}

## Main Entities

- request
- decision
- execution
- evidence

## Storage

Postgres, optional vector index

## Security Requirements

Purpose-of-use and class-aware filters