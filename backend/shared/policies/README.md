# Policy Bundles

This directory contains baseline policy bundles for MVP.

- `rego/base.rego`: default-deny authorization logic and approval gating.
- `cedar/base.cedar`: principal/action/resource policy examples.

Policy release process:
1. Author in feature branch.
2. Run policy unit tests and regression corpus.
3. Sign bundle artifact.
4. Publish with dual approval in production.