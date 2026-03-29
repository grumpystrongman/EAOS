# auth-service

## Purpose

OIDC/SAML federation, token issuance, session assurance

## API Contracts

- POST /v1/auth/login
- POST /v1/auth/token/refresh
- POST /v1/auth/step-up

## Main Entities

- request
- decision
- execution
- evidence

## Storage

Postgres

## Security Requirements

MFA, token rotation, session assurance checks