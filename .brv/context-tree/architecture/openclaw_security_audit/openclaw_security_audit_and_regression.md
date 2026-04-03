---
title: OpenClaw Security Audit and Regression
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-04-03T14:07:13.110Z'
updatedAt: '2026-04-03T14:07:13.110Z'
---
## Raw Concept
**Task:**
Document results and procedures for OpenClaw security audit, dependency risk scan, and security regression testing

**Changes:**
- Refreshed OpenClaw/manus-mcp/openclaw-cli to latest
- Applied OpenClaw security ACL hardening
- Deep security audit now 0 critical/0 warn
- All repo dependency, audit, and regression checks pass
- Smoke:pilot and smoke:roles pass after patching
- Dependency and secrets scan executed
- Security regression suite: 14/14 checks passed

**Files:**
- docs/security/VULN-REPORT-DEPENDENCIES.md
- docs/assets/demo/security-regression-report.json
- .env

**Flow:**
Patch and audit -> Run dependency risk scan -> Run security regression suite -> Validate all checks pass

**Timestamp:** 2026-04-03T14:07:13.107Z

**Author:** Automated security pipeline

**Patterns:**
- `node_modules/.*/fsevents` - Accepted optional install-script package
- `node_modules/esbuild` - Accepted install-script package
- `^VITE_.*_EMAIL=.*@grumpyman-distributors.com$` - Env var for OpenAegis role email
- `^VITE_API_URL=` - Env var for OpenAegis API URL
- `^VITE_TOOL_REGISTRY_URL=` - Env var for tool registry URL

## Narrative
### Structure
Covers the audit and testing procedures for OpenClaw and OpenAegis, including dependency scanning, security regression, and environment hardening. Details the flow from patch to validation.

### Dependencies
Requires OpenClaw/manus-mcp/openclaw-cli, npm audit, project repo, and pre-configured .env with OpenAegis settings.

### Highlights
All dependency and security regression checks passed; no critical or warning issues remain; audit and risk scan output fully captured.

### Rules
1. All install-script packages must be explicitly accepted and justified.
2. Audit exit codes must be 0 for both full and production.
3. No secret-like patterns are permitted in source/config.
4. Security regression suite must pass all critical checks before deploy.
5. All environment variables must be set with correct OpenAegis role emails and URLs.

### Examples
Example accepted install-script: node_modules/esbuild. Example regression check: demo_login_disabled_by_default (PASS). Example .env var: VITE_API_URL=http://127.0.0.1:3000

## Facts
- **OpenClaw/manus-mcp/openclaw-cli packages**: Global OpenClaw/manus-mcp/openclaw-cli packages were refreshed to the latest available versions.
- **OpenClaw**: An OpenClaw security audit fix was applied, including ACL hardening on ~/.openclaw and agent/session paths.
- **OpenClaw**: A deep security audit now reports 0 critical and 0 warning issues.
- **repository dependencies**: Repository dependency and security scans pass, with npm audit reporting 0 vulnerabilities.
- **repository**: Vulnerability dependencies and security regression checks both pass.
- **smoke tests**: Smoke:pilot and smoke:roles tests pass after patching.
- **dependency and secrets risk scan**: A dependency and secrets risk scan was generated at 2026-04-03T14:05:52.127Z for repository root C:/Users/grump/EAOS.
- **npm audit**: npm audit was run against the full dependency tree and for production-only dependencies.
- **dependency and secrets risk scan**: Workspace manifest lifecycle hooks, lockfile install scripts, and accepted transitive install-script packages were included in the scan scope.
- **dependency and secrets risk scan**: Executable scripts and Dockerfiles that call npm install with default lifecycle execution were included in the scan scope.
- **dependency and secrets risk scan**: Hardcoded secret-like literals and credential patterns were checked in the scan.
- **full dependency audit**: Full dependency audit passed with 127 dependencies and 0 vulnerabilities (critical=0, high=0, moderate=0, low=0, info=0).
- **manifest lifecycle hooks**: No manifest lifecycle hooks were found.
- **install-script packages**: Three accepted transitive install-script packages were found.
- **npm install**: No executable files use default npm install behavior.
- **secret scan**: No secret-like patterns were found.
- **full dependency audit**: Full audit exit code was 0.
- **production dependency audit**: Production audit exit code was 0.
- **script and lockfile risks**: No script-default risks were found.
- **install-script packages**: The packages node_modules/esbuild, node_modules/fsevents (optional), and node_modules/playwright/node_modules/fsevents (optional) retain install scripts by design and are accepted because the build now uses npm ci.
- **secret scan**: No hardcoded secret-like literals were found in the scanned source and config files.
- **vuln-scan-dependencies.mjs**: The JSON report is emitted on stdout by node tools/scripts/vuln-scan-dependencies.mjs and includes the command results, findings, and summary counts.
- **dependency and secrets risk scan**: Overall scan result: PASS.
- **security regression report**: A security regression report was generated at 2026-04-03T14:05:48.937Z.
- **security regression suite**: The security regression suite ran 14 checks, all of which passed.
- **demo login**: The demo login is disabled by default.
- **demo token**: Demo token is denied when introspection is required.
- **auth service**: The auth service issues introspectable tokens.
- **token introspection**: Introspected token allows same tenant execution.
- **cross-tenant write**: Cross-tenant write is blocked.
- **approval decision**: Approval decision requires approver role.
- **approval decision**: Approval decision enforces tenant scope.
- **approval list**: Approval list requires privileged roles.
- **tool execution**: Tool execution requires tenant and actor context.
- **live tool execute**: Live tool execute requires idempotency key.
- **tool idempotency**: Tool idempotency reuse mismatch is blocked.
- **tool call lookup**: Tool call lookup is tenant scoped.
- **blocking policy change**: Break glass is required for blocking policy change.
- **revoked token**: Revoked token is denied via introspection.
- **.env file**: The .env file contains configuration for OpenAegis local runtime profile for GrumpyMan Distributors.
- **VITE_OPENAEGIS_ADMIN_EMAIL**: The environment variable VITE_OPENAEGIS_ADMIN_EMAIL is set to platform-admin@grumpyman-distributors.com.
- **VITE_API_URL**: The environment variable VITE_API_URL is set to http://127.0.0.1:3000.
- **VITE_TOOL_REGISTRY_URL**: The environment variable VITE_TOOL_REGISTRY_URL is set to http://127.0.0.1:4301.
- **VITE_ENABLE_DEMO_IDENTITIES**: The environment variable VITE_ENABLE_DEMO_IDENTITIES is set to true.
- **file contents**: The file contents above have been pre-loaded.
- **read_file tool**: Users are instructed not to use the read_file tool for the files above because the content is already provided.
- **diagrams preservation**: Users are instructed to preserve all diagrams (Mermaid, PlantUML, ASCII art) verbatim using narrative.diagrams array.
- **table preservation**: Users are instructed to preserve all tables with every row and not to summarize table data.
- **code and API preservation**: Users are instructed to preserve exact code examples, API signatures, and interface definitions.
- **procedures preservation**: Users are instructed to preserve step-by-step procedures and numbered instructions in narrative.rules.
- **table data**: Do not summarize table data with every row.
- **code examples, API signatures, interface definitions**: Preserve exact code examples, API signatures, and interface definitions.
- **step-by-step procedures, numbered instructions**: Preserve step-by-step procedures and numbered instructions in narrative.rules.
