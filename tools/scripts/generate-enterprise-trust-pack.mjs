#!/usr/bin/env node
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const packageId = new Date().toISOString().replace(/[:.]/g, "-");
const packageRoot = resolve("docs", "assets", "enterprise-trust-pack", packageId);
const latestRoot = resolve("docs", "assets", "enterprise-trust-pack", "latest");

const requiredFiles = [
  "docs/compliance/CONTROL-CROSSWALK.json",
  "docs/compliance/ENTERPRISE-TRUST-PACK.md",
  "docs/compliance/EXTERNAL-PENTEST-READY-CHECKLIST.md",
  "docs/security/HARDENING-CONTROLS-MATRIX.md",
  "docs/threat-model.md",
  "docs/commercial/CISO-DECISION-BRIEF.md",
  "docs/assets/demo/readiness-gate-report.json",
  "docs/assets/demo/commercial-proof-report.json",
  "docs/assets/demo/trust-layer-proof-report.json",
  "docs/assets/demo/security-regression-report.json",
  "docs/assets/demo/codebase-line-audit-report.json",
  "docs/assets/demo/design-partner-kpis.json",
  "docs/assets/demo/chaos-report.json",
  "docs/assets/demo/load-test-report.json"
];

const hashFile = async (path) => {
  const raw = await readFile(path);
  return createHash("sha256").update(raw).digest("hex");
};

const copyWithParents = async (root, relativePath) => {
  const destination = resolve(root, relativePath.replace(/^docs[\\/]/, ""));
  await mkdir(resolve(destination, ".."), { recursive: true });
  await cp(resolve(relativePath), destination, { recursive: true });
  return destination;
};

const run = async () => {
  await mkdir(packageRoot, { recursive: true });
  const copied = [];
  const missing = [];
  const checksums = [];

  for (const relativePath of requiredFiles) {
    try {
      const destination = await copyWithParents(packageRoot, relativePath);
      copied.push(relativePath);
      checksums.push({
        file: relativePath,
        sha256: await hashFile(destination),
        sizeBytes: (await stat(destination)).size
      });
    } catch {
      missing.push(relativePath);
    }
  }

  const crosswalk = JSON.parse(await readFile(resolve("docs/compliance/CONTROL-CROSSWALK.json"), "utf8"));
  const readiness = JSON.parse(await readFile(resolve("docs/assets/demo/readiness-gate-report.json"), "utf8"));
  const commercial = JSON.parse(await readFile(resolve("docs/assets/demo/commercial-proof-report.json"), "utf8"));
  const trust = JSON.parse(await readFile(resolve("docs/assets/demo/trust-layer-proof-report.json"), "utf8"));
  const codebaseAudit = JSON.parse(await readFile(resolve("docs/assets/demo/codebase-line-audit-report.json"), "utf8"));
  const securityRegression = JSON.parse(await readFile(resolve("docs/assets/demo/security-regression-report.json"), "utf8"));
  const kpis = JSON.parse(await readFile(resolve("docs/assets/demo/design-partner-kpis.json"), "utf8"));

  const frameworkSet = new Set(crosswalk.frameworks ?? []);
  const frameworksComplete =
    frameworkSet.has("SOC2") && frameworkSet.has("ISO27001") && frameworkSet.has("HIPAA");
  const controlCount = Array.isArray(crosswalk.controls) ? crosswalk.controls.length : 0;

  const readinessScorePercent = Number(readiness.summary?.scorePercent ?? 0);

  const statusChecks = [
    String(commercial.summary?.status ?? "FAIL") === "PASS",
    String(trust.summary?.status ?? "FAIL") === "PASS",
    String(securityRegression.summary?.status ?? "FAIL") === "PASS",
    String(codebaseAudit.summary?.status ?? "FAIL") === "PASS",
    String(kpis.summary?.status ?? "FAIL") === "PASS",
    frameworksComplete,
    controlCount >= 18,
    missing.length === 0
  ];

  const status = statusChecks.every(Boolean) ? "PASS" : "FAIL";
  const summary = {
    status,
    frameworks: [...frameworkSet],
    frameworksComplete,
    controlCount,
    readinessScorePercent,
    blockedRiskyActions: Number(kpis.pilots?.global?.blockedRiskyActions ?? 0),
    auditCompletenessPercent: Number(kpis.pilots?.global?.auditCompletenessPercent ?? 0),
    missingRequiredFiles: missing.length
  };

  const executiveBrief = [
    "# OpenAegis Enterprise Trust Pack",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Package ID: ${packageId}`,
    `Status: ${summary.status}`,
    "",
    "## Readiness Snapshot",
    `- Readiness gate: ${readiness.summary?.status ?? "UNKNOWN"} (${readinessScorePercent}%)`,
    `- Commercial proof: ${commercial.summary?.status ?? "UNKNOWN"} (${commercial.summary?.scorePercent ?? 0}%)`,
    `- Trust proof: ${trust.summary?.status ?? "UNKNOWN"} (${trust.summary?.passedExamples ?? 0}/${trust.summary?.totalExamples ?? 0} examples)`,
    `- Security regression: ${securityRegression.summary?.status ?? "UNKNOWN"} (${securityRegression.summary?.scorePercent ?? 0}%)`,
    `- Codebase audit: ${codebaseAudit.summary?.status ?? "UNKNOWN"} (findings=${codebaseAudit.summary?.totalFindings ?? "n/a"})`,
    "",
    "## Compliance Mapping Snapshot",
    `- Frameworks: ${[...frameworkSet].join(", ")}`,
    `- Framework completeness (SOC2+ISO27001+HIPAA): ${frameworksComplete ? "Yes" : "No"}`,
    `- Mapped controls: ${controlCount}`,
    "",
    "## KPI Snapshot",
    `- Blocked risky actions: ${summary.blockedRiskyActions}`,
    `- Audit completeness: ${summary.auditCompletenessPercent}%`,
    "",
    "## External Validation",
    "- Pentest checklist is included in `compliance/EXTERNAL-PENTEST-READY-CHECKLIST.md`.",
    "",
    "## Integrity",
    "- File-level SHA-256 checksums are in `manifest.json`."
  ].join("\n");

  const manifest = {
    packageId,
    generatedAt: new Date().toISOString(),
    requiredFiles,
    copied,
    missing,
    checksums,
    summary
  };

  await writeFile(resolve(packageRoot, "EXECUTIVE-BRIEF.md"), `${executiveBrief}\n`, "utf8");
  await writeFile(resolve(packageRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  await rm(latestRoot, { recursive: true, force: true });
  await mkdir(latestRoot, { recursive: true });
  await cp(packageRoot, latestRoot, { recursive: true });
  await writeFile(
    resolve("docs", "assets", "enterprise-trust-pack", "latest.json"),
    `${JSON.stringify({ packageId, path: `docs/assets/enterprise-trust-pack/${packageId}` }, null, 2)}\n`,
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        status,
        packageId,
        packagePath: `docs/assets/enterprise-trust-pack/${packageId}`,
        latestPath: "docs/assets/enterprise-trust-pack/latest",
        summary
      },
      null,
      2
    )
  );
  if (status !== "PASS") process.exitCode = 1;
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
