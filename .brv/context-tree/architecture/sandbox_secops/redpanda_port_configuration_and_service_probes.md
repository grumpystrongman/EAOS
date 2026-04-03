---
title: Redpanda Port Configuration and Service Probes
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-04-03T13:53:07.432Z'
updatedAt: '2026-04-03T13:53:07.432Z'
---
## Raw Concept
**Task:**
Document non-conflicting Redpanda port defaults and coordinated probe configuration for Secops sandbox

**Changes:**
- Redpanda Kafka port set to 29092
- Redpanda Admin port set to 29644
- Probe URLs updated in deployments/sandboxes/secops/sandbox.json
- Legacy ports 19092/19644 avoided to prevent stack collisions

**Files:**
- deployments/sandboxes/secops/compose.yaml
- deployments/sandboxes/secops/sandbox.json

**Flow:**
Configure docker compose -> Set Redpanda ports -> Update probe URLs -> Enable independent sandbox proof

**Timestamp:** 2026-04-03

## Narrative
### Structure
Redpanda, Prometheus, Grafana, and OPA are defined as docker compose services. Redpanda uses host-mapped ports driven by environment variables defaulting to 29092 (Kafka) and 29644 (Admin). Probe endpoints in sandbox.json are aligned to these ports for health checks.

### Dependencies
Requires Docker Compose stack and matching environment variable setup. Other stacks must avoid conflicting port assignments.

### Highlights
Sandbox proof passes without stopping unrelated containers. No port collisions with legacy stacks. Probe health checks are tightly coupled to deployment port settings.

### Rules
Rule 1: Always use non-conflicting port assignments for sandbox services.
Rule 2: Probe URLs in sandbox.json must reflect current port mappings.
Rule 3: Stopping unrelated containers is not required for sandbox proof.

### Examples
Redpanda Kafka available on localhost:29092, admin API on 29644. Prometheus on 19090, Grafana on 13000, OPA on 18181.

## Facts
- **redpanda_ports**: Secops sandbox Redpanda uses Kafka port 29092 and admin port 29644 by default [project]
- **legacy_ports**: Legacy stacks used ports 19092/19644, which could cause conflicts [project]
- **probe_urls**: Probe URLs for Redpanda, Prometheus, Grafana, and OPA are updated to match these ports in sandbox.json [project]
