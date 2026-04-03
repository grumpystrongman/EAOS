---
children_hash: dba1dcc24c9b1043bc8221b3ae7774765c67b24a76dd9cb06055e842daa192d4
compression_ratio: 0.6363118952760387
condensation_order: 1
covers: [context.md, redpanda_port_configuration_and_service_probes.md, sandbox_secops_configuration.md]
covers_token_total: 1757
summary_level: d1
token_count: 1118
type: summary
---
# Sandbox SecOps Structural Summary

## Overview

The `sandbox_secops` domain documents the configuration, operational validation, and architectural decisions for the SecOps sandbox environment. It encompasses Docker Compose service definitions, environment variable management, port parameterization, service health probes, and integration with OpenClaw and Manus MCP. Key implementation details and rules are distributed across the following entries:

---

## Key Topics and Relationships

### 1. Configuration and Service Composition (`sandbox_secops_configuration.md`)
- **Docker Compose Services:** Defines Redpanda, Prometheus, Grafana, and OPA as core services in `deployments/sandboxes/secops/compose.yaml`.
  - **Redpanda:** Uses image `docker.redpanda.com/redpandadata/redpanda:v25.1.2`, with parameterized ports for Kafka (`SANDBOX_SECOPS_REDPANDA_KAFKA_PORT`, default 29092) and Admin (`SANDBOX_SECOPS_REDPANDA_ADMIN_PORT`, default 29644).
  - **Prometheus:** Exposes port 19090.
  - **Grafana:** Exposes port 13000.
  - **OPA:** Exposes port 18181.
- **Environment Variables:** `.env` and `.env.example` files define all critical configuration keys, including Redpanda ports, OpenClaw gateway settings, and Manus MCP API credentials.
- **Service Probes:** `sandbox.json` specifies health check URLs for each service, all expecting HTTP 200 status.
- **Integration:** OpenClaw CLI and Manus MCP are installed and configured, with local token authentication for OpenClaw.
- **Operational Validation:** Full sandbox rerun must pass all steps (startup, seeding, provisioning, smoke tests).

### 2. Port Assignment and Health Probes (`redpanda_port_configuration_and_service_probes.md`)
- **Non-Conflicting Ports:** Redpanda Kafka defaults to 29092, Admin to 29644, avoiding legacy ports 19092/19644 to prevent stack collisions.
- **Probe Alignment:** Probe URLs in `sandbox.json` are updated to match these ports, ensuring health checks are accurate and reliable.
- **Legacy Avoidance:** Explicitly avoids stopping unrelated containers; sandbox proof is isolated and does not interfere with other stacks.
- **Rules:**
  - Always use non-conflicting, parameterized port assignments.
  - Probe URLs must reflect current port mappings.
  - Stopping unrelated containers is unnecessary for sandbox proof.

---

## Architectural Decisions and Patterns

- **Port Parameterization:** All Redpanda ports are parameterized via environment variables to ensure compatibility and prevent conflicts across stacks.
- **Service Health Validation:** Health probes are tightly coupled to deployment port settings and must be kept in sync.
- **Configuration Preservation:** All configuration keys and values are documented and validated through `.env` and `.env.example`.
- **Stepwise Operational Proof:** The sandbox environment is validated through a series of operational steps, with explicit success criteria for each.

---

## Where to Drill Down

- **Service definitions, port mappings, and probe URLs:** See `sandbox_secops_configuration.md` and `redpanda_port_configuration_and_service_probes.md`
- **Integration details with OpenClaw and Manus MCP:** See `sandbox_secops_configuration.md`
- **Rules and validation procedures:** Both entries, with explicit rules and operational highlights
- **Exact configuration keys and code examples:** `sandbox_secops_configuration.md` (preserves verbatim config and API signatures)

---

## Summary Table

| Aspect                        | Details/References                                    |
|-------------------------------|------------------------------------------------------|
| Docker Compose Services       | Redpanda, Prometheus, Grafana, OPA                   |
| Port Parameterization         | Kafka: 29092, Admin: 29644 (env-driven)              |
| Health Probes                 | Probe URLs in `sandbox.json`, HTTP 200 expected      |
| Integration                   | OpenClaw CLI, Manus MCP, local token auth            |
| Configuration Files           | `.env`, `.env.example`, `compose.yaml`, `sandbox.json`|
| Operational Validation        | Full rerun: startup, seeding, provisioning, smoke    |
| Rules                         | Non-conflicting ports, probe alignment, config validation |

---

This structural summary condenses the configuration, operational, and architectural knowledge for the sandbox SecOps environment. For implementation specifics and detailed procedures, consult the referenced entries.