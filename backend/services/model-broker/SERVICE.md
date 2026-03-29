# model-broker

## Purpose

Vendor-neutral model routing and adapter dispatch

## API Contracts

- POST /v1/model/infer
- POST /v1/model/route/preview
- GET /v1/model/providers

## Main Entities

- request
- decision
- execution
- evidence

## Storage

Postgres, Redis

## Security Requirements

Sensitivity-aware routing and zero-retention enforcement