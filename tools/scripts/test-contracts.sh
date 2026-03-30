#!/usr/bin/env bash
set -euo pipefail

echo "[contracts] Building workspace"
npm run build

echo "[contracts] Running contract and readiness commercial tests"
node --test tests/commercial/commercial-proof.test.mjs tests/commercial/trust-layer-proof.test.mjs tests/commercial/readiness-gate-score.test.mjs

echo "[contracts] Validating packaging and test surface"
npm run validate:infra
npm run validate:test-surface

echo "[contracts] PASS"
