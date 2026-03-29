# tool-registry

## Purpose

Signed connector/tool manifest registry

## API Contracts

- GET /healthz
- GET /v1/tools?status=published&trustTier=tier-1&capability=fhir
- GET /v1/tools/{id}
- POST /v1/tools (requires `x-actor-id`)
- POST /v1/tools/{id}/publish (requires `x-actor-id`)

## Main Entities

- tool manifest
- manifest publication record
- connector trust tier
- signed policy scope set

## Storage

`.volumes/tool-registry-state.json` for the pilot (replace with Postgres in production)

## Security Requirements

- Signed tool definitions and scope validation
- Actor header required for all write operations
- Default published manifests for tiered connectors:
  - Microsoft Fabric
  - Power BI
  - SQL
  - FHIR
  - HL7
  - SharePoint
  - Email
  - Ticketing
  - Linear
