#!/usr/bin/env node
import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const TEST_FILE_PATTERN = /\.test\.(ts|tsx|js|mjs|cjs)$/;
const EXCLUDED_DIRS = new Set(["node_modules", "dist", ".git", ".tmp-test", ".next"]);

const readJson = async (filePath) => JSON.parse(await readFile(resolve(filePath), "utf8"));

const listWorkspacePackageDirs = async () => {
  const rootPackage = await readJson("package.json");
  const patterns = Array.isArray(rootPackage.workspaces) ? rootPackage.workspaces : [];
  const packageDirs = [];

  for (const pattern of patterns) {
    const wildcardIndex = pattern.indexOf("*");
    if (wildcardIndex === -1) {
      const full = resolve(pattern);
      try {
        await stat(resolve(full, "package.json"));
        packageDirs.push(full);
      } catch {
        // ignore non-package directory
      }
      continue;
    }

    const base = resolve(pattern.slice(0, wildcardIndex).replace(/[\\/]+$/, ""));
    let entries = [];
    try {
      entries = await readdir(base, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const workspaceDir = join(base, entry.name);
      try {
        await stat(resolve(workspaceDir, "package.json"));
        packageDirs.push(workspaceDir);
      } catch {
        // skip folders without package.json
      }
    }
  }

  return packageDirs.sort((left, right) => left.localeCompare(right));
};

const countTestFiles = async (workspaceDir) => {
  const stack = [workspaceDir];
  let count = 0;

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) continue;
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) stack.push(fullPath);
        continue;
      }
      if (TEST_FILE_PATTERN.test(entry.name)) count += 1;
    }
  }

  return count;
};

const run = async () => {
  const workspaceDirs = await listWorkspacePackageDirs();
  const workspaces = [];

  for (const workspaceDir of workspaceDirs) {
    const packageJson = await readJson(join(workspaceDir, "package.json"));
    const testFileCount = await countTestFiles(workspaceDir);
    workspaces.push({
      name: packageJson.name ?? workspaceDir,
      path: workspaceDir.replace(/\\/g, "/"),
      hasTestScript: Boolean(packageJson.scripts?.test),
      testFileCount
    });
  }

  const failures = workspaces.filter((workspace) => !workspace.hasTestScript || workspace.testFileCount < 1);
  const report = {
    generatedAt: new Date().toISOString(),
    suite: "workspace-test-surface-validation",
    thresholds: {
      minTestFilesPerWorkspace: 1
    },
    summary: {
      workspaceCount: workspaces.length,
      passingWorkspaces: workspaces.length - failures.length,
      failingWorkspaces: failures.length,
      scorePercent:
        workspaces.length === 0
          ? 0
          : Number((((workspaces.length - failures.length) / workspaces.length) * 100).toFixed(2)),
      status: failures.length === 0 ? "PASS" : "FAIL"
    },
    workspaces,
    failures
  };

  await mkdir(resolve("docs/assets/demo"), { recursive: true });
  await writeFile(resolve("docs/assets/demo/test-surface-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(report, null, 2));
  if (report.summary.status !== "PASS") process.exitCode = 1;
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

