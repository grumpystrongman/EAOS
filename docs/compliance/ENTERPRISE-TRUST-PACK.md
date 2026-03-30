# Enterprise Trust Pack

The Enterprise Trust Pack is the buyer-facing and auditor-facing package for security and compliance due diligence.

It is executable and evidence-backed. It is not a slide deck.

## Objectives

- map implemented controls to SOC2, ISO27001, and HIPAA
- export reproducible evidence tied to the current commit
- provide a pentest-ready handoff package for external assessors
- enforce trust-pack quality in CI and readiness gates

## Generate the Pack

```bash
npm run trust:pack
npm run trust:audit
```

## Artifacts

- `docs/assets/enterprise-trust-pack/latest/EXECUTIVE-BRIEF.md`
- `docs/assets/enterprise-trust-pack/latest/manifest.json`
- `docs/assets/enterprise-trust-pack/latest/compliance/CONTROL-CROSSWALK.json`
- `docs/assets/demo/enterprise-trust-pack-audit-report.json`

## Included Framework Crosswalks

- SOC2 (selected common criteria references)
- ISO27001 Annex A control references
- HIPAA Security Rule safeguard references

Crosswalk source:

- `docs/compliance/CONTROL-CROSSWALK.json`

## External Validation Bundle

Use the pentest package in:

- `docs/compliance/EXTERNAL-PENTEST-READY-CHECKLIST.md`

This defines scope, entry points, required artifacts, and acceptance criteria for third-party testing.

## Gate Expectations

Trust Pack is release-ready only when:

1. Trust pack generation exits 0.
2. Trust pack audit exits 0.
3. `manifest.summary.status = PASS`.
4. Framework coverage includes SOC2, ISO27001, and HIPAA.
5. Readiness and proof reports embedded in the pack are PASS.

If any one of those fails, Trust Pack is considered non-releaseable.
