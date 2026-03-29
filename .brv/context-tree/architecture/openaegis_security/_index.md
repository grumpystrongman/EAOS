---
children_hash: d388f6174b29bdee49dc06205d528e4bd0485793b3f04692b29638e8afce817d
compression_ratio: 0.8008658008658008
condensation_order: 1
covers: [openaegis_security_and_governance.md]
covers_token_total: 231
summary_level: d1
token_count: 185
type: summary
---
# OpenAegis Security and Governance Overview
Structural summary of [openaegis_security_and_governance.md].

### Security Architecture
* **Access Control:** OIDC/SAML integration for identity.
* **Isolation:** Multi-tenant architecture utilizing microVMs and hardened containers.
* **Encryption:** Mandatory TLS 1.3 in transit; envelope encryption for data at rest.
* **Audit:** Immutable evidence logs via hash chains.

### Governance & Compliance
* **Critical Rules:** PHI/ePHI exposure is categorized as a system failure. Mandatory policy/approval required for all high-risk actions.
* **Retention:** EPHI default retention policy is 6+ years.

### References
* Data Governance: `docs/data-governance.md`
* Threat Modeling: `docs/threat-model.md`
