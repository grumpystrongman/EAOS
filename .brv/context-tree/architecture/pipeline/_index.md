---
children_hash: ed3bafa83e2efe14e966958c28a13169bdf867ac7074dac4837e7d7d9621c978
compression_ratio: 0.6861042183622829
condensation_order: 1
covers: [context.md, pipeline_and_security_verification.md]
covers_token_total: 806
summary_level: d1
token_count: 553
type: summary
---
# Pipeline: Structural Summary

The **pipeline** enforces automated checks and security gates to ensure platform safety and release assurance. It integrates typechecking, build, security regression, dependency/secrets scanning, smoke tests, sandbox proof, oversight review, and deployment gating.

## Key Structural Elements

- **Pipeline Flow:**  
  Commit → Typecheck → Build → Security Regression → Dependency Scan → Smoke Test → Sandbox Proof → Oversight Review → Deploy

- **Checks and Verification:**  
  - All frontend and backend services must pass all checks.
  - No hardcoded secrets or vulnerabilities are permitted.
  - Deployment is strictly blocked if any check fails, vulnerabilities are found, or audit evidence is missing.
  - Escalation register is maintained for high-risk changes.

- **Security Regression:**  
  - Covers token introspection, tenant scope enforcement, approval decision role enforcement, break-glass for blocking policy changes, and revoked token denial.
  - All 14 security regression checks must pass.

- **Sandbox Proof & Oversight:**  
  - Sandbox proof includes service probes for Trino, Airflow, MinIO, and Grafana.
  - Oversight review requires all 10 checks to pass.
  - Workflow proof steps (e.g., read_pack, load_experience, apply_policy_preset, run_simulation, approve_and_verify) are verified.

- **Key Facts:**  
  - 10/10 oversight checks, 14/14 security regression checks, 0 vulnerabilities, and 0 hardcoded secrets.
  - All 5 sandboxes and associated service probes passed.
  - Dependency and secrets risk scan found no issues; 3 dependency install scripts accepted.
  - Smoke tests for pilot and roles succeeded.

## Related Topics

- See **pipeline_and_security_verification.md** for detailed verification steps and outcomes.
- For audit and regression specifics, reference **architecture/openclaw_security_audit/openclaw_security_audit_and_regression**.

## Files and Artifacts

- Oversight review report: `docs/assets/demo/oversight-review-report.json`
- Key frontend files: `frontend/apps/admin-console/src/app/App.tsx`, `routes.ts`

---

For detailed implementation, verification results, and audit relationships, drill down into the referenced entries.