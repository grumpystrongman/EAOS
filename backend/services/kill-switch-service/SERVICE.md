# kill-switch-service

## Purpose

Emergency halt and scoped circuit breakers

## API Contracts

- POST /v1/kill-switch/activate
- POST /v1/kill-switch/release
- GET /v1/kill-switch/status

## Main Entities

- request
- decision
- execution
- evidence

## Storage

Redis, Postgres

## Security Requirements

Dual approval for global halt