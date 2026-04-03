---
title: Sandbox SecOps Configuration
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-04-03T13:51:13.467Z'
updatedAt: '2026-04-03T13:51:13.467Z'
---
## Raw Concept
**Task:**
Document and parameterize sandbox SecOps runtime configuration (compose, ports, probes, .env)

**Changes:**
- Installed OpenClaw CLI and Manus MCP package
- Configured OpenClaw gateway local token authentication
- Resolved secops port conflicts by parameterizing Redpanda host ports
- Updated Redpanda Admin API probe URL to port 29644
- Confirmed full sandbox rerun passes all steps

**Files:**
- deployments/sandboxes/secops/compose.yaml
- deployments/sandboxes/secops/sandbox.json
- .env
- .env.example

**Flow:**
Setup compose.yaml -> Configure .env -> Run sandbox -> Validate probes -> Confirm operational state

**Timestamp:** 2026-04-03

## Narrative
### Structure
Describes sandbox SecOps runtime: Docker Compose services (Redpanda, Prometheus, Grafana, OPA), port parameterization, .env and .env.example config, service probe URLs, and operational validation steps.

### Dependencies
Requires Docker, configured .env/.env.example, and access to Redpanda, Prometheus, Grafana, and OPA images.

### Highlights
Parameterizes Redpanda ports to avoid conflicts, validates service health via probe URLs, preserves configuration in .env files.

### Rules
1. Always use parameterized ports in compose.yaml for Redpanda (SANDBOX_SECOPS_REDPANDA_KAFKA_PORT, SANDBOX_SECOPS_REDPANDA_ADMIN_PORT).
2. Service probes must expect HTTP 200 status for readiness.
3. Preserve and validate all config keys as in .env/.env.example.
4. All operational steps (sandbox up/proof, seeding, provisioning, smoke tests) must pass.

## Facts
- **OpenClaw CLI, Manus MCP**: OpenClaw CLI and Manus MCP package are installed, and OpenClaw gateway local token authentication is configured.
- **sandbox secops port configuration**: Sandbox secops port conflicts are resolved by parameterizing Redpanda host ports in the secops compose file, with Kafka default port 29092 and admin default port 29644.
- **sandbox probe URLs**: The secops sandbox probe URL for Redpanda Admin API is updated to use port 29644: http://127.0.0.1:29644/v1/status/ready.
- **compose.yaml service setup**: The compose.yaml file for secops defines services: redpanda (image: docker.redpanda.com/redpandadata/redpanda:v25.1.2), prometheus (image: prom/prometheus:v2.55.1), grafana (image: grafana/grafana-oss:11.5.1), and opa (image: openpolicyagent/opa:0.70.0).
- **compose.yaml service setup**: Redpanda service in compose.yaml uses ports ${SANDBOX_SECOPS_REDPANDA_KAFKA_PORT:-29092}:${SANDBOX_SECOPS_REDPANDA_KAFKA_PORT:-29092} for Kafka and ${SANDBOX_SECOPS_REDPANDA_ADMIN_PORT:-29644}:9644 for admin.
- **compose.yaml service setup**: Prometheus service in compose.yaml exposes port 19090:9090.
- **compose.yaml service setup**: Grafana service in compose.yaml exposes port 13000:3000.
- **compose.yaml service setup**: OPA service in compose.yaml exposes port 18181:8181.
- **.env/.env.example config**: .env and .env.example files define SANDBOX_SECOPS_REDPANDA_KAFKA_PORT=29092 and SANDBOX_SECOPS_REDPANDA_ADMIN_PORT=29644.
- **.env/.env.example config**: .env and .env.example files define OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789 and OPENCLAW_GATEWAY_TOKEN for OpenClaw local gateway configuration.
- **.env/.env.example config**: .env and .env.example files define MANUS_MCP_API_BASE_URL=https://api.manus.ai/v1 and MANUS_MCP_API_KEY for Manus MCP configuration.
- **sandbox probe URLs**: The secops sandbox.json file specifies service probes: Redpanda Admin API at http://127.0.0.1:29644/v1/status/ready, Prometheus at http://127.0.0.1:19090/-/ready, Grafana at http://127.0.0.1:13000/api/health, and OPA at http://127.0.0.1:18181/health?plugins and http://127.0.0.1:18181/health, all expecting HTTP 200 status.
- **operational steps**: A full rerun of the sandbox passed all steps: sandbox up/proof (5/5), seed commercial connections, provisioning, smoke pilot, and smoke roles.
- **.env.example**: The .env.example file contains the following configuration keys and values: VITE_OPENAEGIS_ADMIN_EMAIL=platform-admin@grumpyman-distributors.com, VITE_API_URL=http://127.0.0.1:3000, VITE_TOOL_REGISTRY_URL=http://127.0.0.1:4301, VITE_ENABLE_DEMO_IDENTITIES=true.
- **documentation**: PRESERVE exact code examples, API signatures, and interface definitions.
- **documentation**: PRESERVE step-by-step procedures and numbered instructions in narrative.rules.
