---
children_hash: db395dcb2a876c5bca92ca2c17182a92d6ed7c842b60fb73ca79811830cc267e
compression_ratio: 0.9694656488549618
condensation_order: 1
covers: [openaegis_architecture_blueprint.md]
covers_token_total: 262
summary_level: d1
token_count: 254
type: summary
---
# OpenAegis Architecture Overview

The OpenAegis (Enterprise Agent Orchestration and Trust) platform is designed as a vendor-neutral orchestration framework for regulated environments, prioritizing zero-trust principles, PHI/ePHI protection, and immutable evidence chains.

## Core Architectural Planes
The system is organized into five functional layers:
- Experience Plane
- Control Plane
- Secure Agent Runtime
- Data Plane
- Trust Plane

## Technical Requirements
- Infrastructure Dependencies: PostgreSQL, Kafka/NATS, Redis, and Minio.

## Governance and Security
- Core Highlights: Policy-governed agent actions and zero-trust integrity.
- Operational Rules:
  - Data Retention: Zero-retention policy for sensitive data.
  - Break-Glass Protocols: Dual-approval requirement for high-privilege actions.
  - Egress Control: Default deny policy on all external traffic.

For granular implementation details, technical flow, and specific service definitions, refer to the full documentation in openaegis_architecture_blueprint.md.
