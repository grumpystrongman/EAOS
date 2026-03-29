---
children_hash: 2f28efc328c261a34efed412e98e1036f08a61be1f243c170fd71abbd2fd63e8
compression_ratio: 0.7473684210526316
condensation_order: 2
covers: [eaos_overview/_index.md, eaos_security/_index.md]
covers_token_total: 570
summary_level: d2
token_count: 426
type: summary
---
# EAOS Structural Overview (Level D2)

The Enterprise Agent Orchestration and Trust (EAOS) platform provides a vendor-neutral, zero-trust framework designed for highly regulated environments. The architecture is defined by five functional planes: Experience, Control, Secure Agent Runtime, Data, and Trust.

### Architectural Foundations
The system architecture, detailed in `eaos_architecture_blueprint.md`, mandates specific infrastructure dependencies, including PostgreSQL, Kafka/NATS, Redis, and Minio. Security is rooted in a zero-trust model featuring:
* Access Control: OIDC and SAML-based identity management.
* Infrastructure Isolation: Multi-tenant deployment using microVMs and hardened containers.
* Encryption: Mandatory TLS 1.3 for transit and envelope encryption for data at rest.
* Auditability: Immutable evidence chains via hash-based logging.

### Governance and Operational Constraints
Security and governance, summarized in `eaos_security_and_governance.md`, are enforced through strict policy-governed agent actions:
* PHI/ePHI Protection: Exposure of sensitive data is treated as a system failure.
* Retention: EPHI is subject to a 6+ year default retention policy, while non-sensitive data follows a zero-retention model.
* High-Privilege Operations: Break-glass protocols require dual-approval for high-risk actions.
* Network Security: Default deny egress policy for all external traffic.

### Documentation References
For further analysis and implementation, refer to:
* Technical Specifications: `eaos_architecture_blueprint.md`
* Security Standards: `eaos_security_and_governance.md`
* Governance Context: `docs/data-governance.md`
* Threat Landscape: `docs/threat-model.md`