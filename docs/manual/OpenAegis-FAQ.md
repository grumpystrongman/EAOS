# OpenAegis FAQ

## What problem does OpenAegis solve?
OpenAegis enables secure enterprise AI agent orchestration with policy enforcement, approvals, and audit replay.

## Is this a chatbot framework?
No. OpenAegis is infrastructure for regulated enterprise agent workflows.

## How does OpenAegis prevent data leakage?
By default-deny controls, policy-evaluated actions, approval gates, connector scopes, and audit evidence for every major step.

## Does the model decide security policy?
No. Policies are enforced outside the model by control-plane services.

## Can we use multiple model vendors?
Yes. OpenAegis model broker is vendor-neutral and supports adapter-based routing.

## What happens when an action is high risk?
The workflow is blocked until required human approvals are completed.

## Can we run simulation before production?
Yes. Simulation mode is first-class and should be used before live enablement.

## How do we investigate incidents?
Use Audit Explorer + evidence IDs + checkpoint replay.

## Is there a pilot included?
Yes. A hospital discharge assistant pilot is included with smoke and demo scripts.

## Where are screenshots and demo artifacts?
- `docs/assets/screenshots/`
- `docs/assets/demo/pilot-demo-output.json`

## Why does `git push` fail locally?
Because no remote is configured yet. Add one with `git remote add origin <url>`.
