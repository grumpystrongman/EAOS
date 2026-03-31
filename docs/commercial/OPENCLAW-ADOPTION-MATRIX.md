# OpenClaw Feature Adoption Matrix for OpenAegis

This matrix captures high-impact patterns observed in OpenClaw and how OpenAegis should adopt them for enterprise versatility without weakening trust controls.

## Priority Matrix

| Priority | OpenClaw success pattern | Why it matters | OpenAegis adoption |
| --- | --- | --- | --- |
| P0 | Pluginized extension ecosystem | Fast breadth across channels/tools | Added plugin-capable `tool-registry` catalog + plugin instance lifecycle APIs |
| P0 | Multi-channel integration gateway | Real utility comes from where agents can act | Expanded connector catalog across AWS/Databricks/Fabric/Jira/Confluence + LLM providers |
| P0 | Trusted-proxy enterprise auth posture | Enterprise SSO/IdP compatibility | Keep OpenAegis hardened auth posture + continue IdP federation rollout |
| P0 | Multi-agent orchestration model | Complex workflows need role-separated agents | Keep expanding planner/executor/reviewer + approval-gated delegation |
| P0 | Explicit threat model and security docs | Buyer trust and auditability | Maintain trust pack + evidence-first security docs and controls matrix |
| P1 | Provider-agnostic model directory | Vendor portability and resiliency | Expanded model-broker provider variants + richer capability metadata |
| P1 | Built-in failover/routing reasons | Operational predictability under incidents | Added route reason codes and richer blocked-candidate diagnostics |
| P1 | Onboarding wizard + operator guidance | Faster evaluator activation | Setup Center + Integration Hub guided flow; continue to harden one-command onboarding |
| P1 | Health/doctor operational checks | Lower support burden | Continue building readiness gates + health surfaces for every critical plane |
| P2 | Remote access/mobile operations | Convenience but lower immediate ROI | Defer until trust-plane and connector maturity gates are complete |
| P2 | Consumer-facing interaction polish | Nice-to-have for enterprise core | Keep secondary to policy/audit/security requirements |
| P2 | Broad device-level command surface | Powerful but high blast-radius risk | Only adopt with strict sandbox, policy checks, and approval controls |

## Sources

- OpenClaw features overview: https://docs.openclaw.ai/concepts/features
- OpenClaw session concepts: https://docs.openclaw.ai/concepts/session
- OpenClaw architecture: https://docs.openclaw.ai/concepts/architecture
- OpenClaw plugins: https://docs.openclaw.ai/cli/plugins
- OpenClaw providers: https://docs.openclaw.ai/providers
- OpenClaw trusted-proxy auth: https://docs.openclaw.ai/gateway/trusted-proxy-auth
- OpenClaw gateway security: https://docs.openclaw.ai/gateway/security
- OpenClaw threat model: https://docs.openclaw.ai/security/THREAT-MODEL-ATLAS
- OpenClaw onboarding wizard: https://docs.openclaw.ai/start/wizard
- OpenClaw doctor command: https://docs.openclaw.ai/gateway/doctor
