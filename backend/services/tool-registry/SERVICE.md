# tool-registry

## Purpose

Signed connector/tool manifest registry

## API Contracts

- GET /healthz
- GET /v1/tools?status=published&trustTier=tier-1&capability=fhir
- GET /v1/tools/{id}
- POST /v1/tools (requires `x-actor-id`)
- POST /v1/tools/{id}/publish (requires `x-actor-id`)
- GET /v1/plugins/instances
- POST /v1/plugins/instances
- POST /v1/plugins/instances/{id}/authorize
- POST /v1/plugins/instances/{id}/test

## Main Entities

- tool manifest
- manifest publication record
- connector trust tier
- signed policy scope set
- plugin instance
- plugin auth method (`oauth2`, `api_key`, `service_principal`, `key_pair`)
- broker references for authorization artifacts

## Storage

`.volumes/tool-registry-state.json` for the pilot (replace with Postgres in production)

## Security Requirements

- Signed tool definitions and scope validation
- Actor header required for all write operations
- Secrets must be `vault://...` references (raw secrets rejected)
- OAuth authorization artifacts must be `broker://...` references
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
  - AWS
  - Databricks
  - Jira
  - Confluence
  - OpenAI
  - Anthropic
  - Google
  - Azure OpenAI
