---
title: EAOS Security and Governance
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-03-29T19:54:17.128Z'
updatedAt: '2026-03-29T19:54:17.128Z'
---
## Raw Concept
**Task:**
Document EAOS security and data governance

**Files:**
- docs/data-governance.md
- docs/threat-model.md

**Timestamp:** 2026-03-29

## Narrative
### Structure
Security relies on OIDC/SAML, multi-tenant isolation, and hardened runtime environments (microVM/hardened containers).

### Highlights
TLS 1.3 in transit, envelope encryption at rest, immutable evidence logs with hash chains.

### Rules
PHI/ePHI exposure is a system failure. All high-risk actions require mandatory policy/approval.

## Facts
- **phi_security_policy**: PHI/ePHI exposure is treated as a system failure [project]
- **ephi_retention**: EPHI default retention is 6y+ [project]
- **tls_version**: TLS 1.3 is required for all transit [project]
