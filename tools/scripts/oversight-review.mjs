#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const outputPath = resolve(process.cwd(), "docs", "assets", "demo", "oversight-review-report.json");

const parseDotEnv = async () => {
  const envPath = resolve(process.cwd(), ".env");
  try {
    const raw = await readFile(envPath, "utf8");
    const entries = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        if (index <= 0) return null;
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim();
        return { key, value };
      })
      .filter((item) => item !== null);
    return Object.fromEntries(entries.map((entry) => [entry.key, entry.value]));
  } catch {
    return {};
  }
};

const runCommand = async (id, command, env = {}) => {
  const started = Date.now();
  return await new Promise((resolveResult) => {
    const child = spawn(command, {
      cwd: process.cwd(),
      shell: true,
      env: {
        ...process.env,
        ...env
      }
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolveResult({
        id,
        command,
        exitCode: typeof code === "number" ? code : 1,
        durationMs: Date.now() - started,
        passed: code === 0,
        stdoutTail: stdout.slice(-4000),
        stderrTail: stderr.slice(-4000)
      });
    });
  });
};

const run = async () => {
  const dotEnv = await parseDotEnv();
  const openClawToken = dotEnv.OPENCLAW_GATEWAY_TOKEN ?? process.env.OPENCLAW_GATEWAY_TOKEN ?? "";
  const manusKey = dotEnv.MANUS_MCP_API_KEY ?? process.env.MANUS_MCP_API_KEY ?? "";

  const checks = [];
  checks.push(await runCommand("typecheck", "npm run typecheck"));
  checks.push(await runCommand("build", "npm run build"));
  checks.push(await runCommand("security_regression", "npm run security:regression"));
  checks.push(await runCommand("vuln_dependencies", "npm run vuln:dependencies"));
  checks.push(await runCommand("smoke_pilot", "npm run smoke:pilot"));
  checks.push(await runCommand("smoke_roles", "npm run smoke:roles"));
  checks.push(await runCommand("sandbox_proof", "npm run sandbox:proof"));
  checks.push(await runCommand("openclaw_gateway_probe", "openclaw gateway probe"));
  checks.push(
    await runCommand(
      "openclaw_security_audit_deep",
      openClawToken.length > 0
        ? `openclaw security audit --deep --token "${openClawToken}"`
        : "openclaw security audit --deep"
    )
  );
  checks.push(await runCommand("openclaw_update_status", "openclaw update status --json"));

  const passedChecks = checks.filter((check) => check.passed).length;
  const report = {
    generatedAt: new Date().toISOString(),
    suite: "oversight-review",
    outputPath,
    context: {
      manusApiKeyConfigured: manusKey.trim().length > 0,
      openClawGatewayTokenConfigured: openClawToken.trim().length > 0
    },
    checks,
    summary: {
      totalChecks: checks.length,
      passedChecks,
      failedChecks: checks.length - passedChecks,
      status: passedChecks === checks.length ? "PASS" : "FAIL"
    }
  };

  await mkdir(resolve(process.cwd(), "docs", "assets", "demo"), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report.summary, null, 2));
  if (report.summary.status !== "PASS") process.exitCode = 1;
};

run().catch((error) => {
  console.error("oversight_review_failed", error);
  process.exitCode = 1;
});
