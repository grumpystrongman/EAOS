---
children_hash: 42ffc59ce9d1972aea5ff5f8a62c4cb1c1d23f9f24bb0b362184e7a4b03724ab
compression_ratio: 0.6995967741935484
condensation_order: 3
covers: [architecture/_index.md]
covers_token_total: 496
summary_level: d3
token_count: 347
type: summary
---
# EAOS Structural Overview (Level D3)

The Enterprise Agent Orchestration and Trust (EAOS) platform is a zero-trust, vendor-neutral framework for regulated environments, organized into five functional planes: Experience, Control, Secure Agent Runtime, Data, and Trust.

### Architectural Foundations
Detailed in `eaos_architecture_blueprint.md`, the platform utilizes a core dependency stack of PostgreSQL, Kafka/NATS, Redis, and Minio. Security is enforced through:
* Identity: OIDC/SAML-based management.
* Isolation: Multi-tenant microVMs and hardened containers.
* Data Protection: Mandatory TLS 1.3 in transit and envelope encryption at rest.
* Auditability: Immutable hash-based evidence chains.

### Governance and Operational Constraints
Defined in `eaos_security_and_governance.md`, the platform mandates strict operational boundaries:
* Sensitive Data: PHI/ePHI exposure is a failure state; retention is set to 6+ years for ePHI, with zero-retention for non-sensitive data.
* Risk Management: High-privilege actions require dual-approval (break-glass protocols).
* Network: Default-deny egress policy for all external traffic.

### Reference Documents
For deep-dive analysis, consult:
* `eaos_architecture_blueprint.md` (Technical Specs)
* `eaos_security_and_governance.md` (Security Standards)
* `docs/data-governance.md` (Governance)
* `docs/threat-model.md` (Threat Landscape)