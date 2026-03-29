# EAOS Operator Manual

## 1. Platform Purpose

EAOS orchestrates enterprise AI agents with externalized policy, approvals, and auditability. It is built for regulated environments where trust and evidence are non-negotiable.

## 2. Core Concepts

- Tenant: isolated organizational boundary
- Workflow: deterministic multi-step execution plan
- Agent Runtime: sandboxed step execution environment
- Policy Decision: `ALLOW`, `DENY`, or `REQUIRE_APPROVAL`
- Approval Ticket: human gate for high-risk actions
- Evidence Envelope: immutable audit record for major actions

## 3. Operator Responsibilities

1. Maintain policy bundles and review changes
2. Monitor pending approvals and blocked executions
3. Validate model routing constraints for sensitive data
4. Investigate incidents using audit + evidence explorer
5. Run simulation before enabling live workflows

## 4. Secure Operating Rules

- Never bypass policy checks in production
- Never use external models for sensitive data without explicit policy allow
- Never grant break-glass access without dual approval
- Always preserve evidence chain integrity
- Always apply least privilege for operators and connectors

## 5. Daily Operations Checklist

- Review dashboard KPI trends
- Review pending approvals
- Review blocked executions
- Check audit stream for anomalies
- Verify service health and queue depth

## 6. Incident Response Basics

1. Activate scoped kill-switch if needed
2. Capture incident timeline and evidence IDs
3. Replay execution checkpoints
4. Record containment actions
5. Complete post-incident review package

## 7. Compliance Evidence Exports

EAOS supports export packages for:

- Security review
- Compliance review
- Incident response
- Executive reporting

Use the evidence IDs shown in the Audit Explorer to package chain-of-custody artifacts.