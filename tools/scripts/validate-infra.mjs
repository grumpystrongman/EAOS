#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parseAllDocuments } from "yaml";

const expectedServices = [
  "api-gateway",
  "auth-service",
  "tenant-service",
  "policy-service",
  "workflow-orchestrator",
  "agent-registry",
  "tool-registry",
  "tool-execution-service",
  "model-broker",
  "context-retrieval-service",
  "classification-service",
  "approval-service",
  "audit-ledger",
  "notification-service",
  "secrets-broker",
  "observability-service",
  "kill-switch-service"
];

const loadYamlDocs = async (file) => {
  const raw = await readFile(resolve(file), "utf8");
  return parseAllDocuments(raw).map((doc) => doc.toJSON()).filter(Boolean);
};

const readText = async (file) => readFile(resolve(file), "utf8");

const validateDockerfile = async (service) => {
  const dockerfilePath = resolve(`backend/services/${service}/Dockerfile`);
  const content = await readFile(dockerfilePath, "utf8");
  const cmdExpected = `CMD ["node", "dist/services/${service}/src/index.js"]`;
  return {
    service,
    passed:
      content.includes("npm run build --workspace @openaegis/") &&
      content.includes("COPY --from=build /workspace/dist ./dist") &&
      content.includes(cmdExpected),
    details: {
      dockerfilePath,
      cmdExpected
    }
  };
};

const validateK8s = async () => {
  const deployDir = resolve("infrastructure/kubernetes/base/deployments");
  const serviceDir = resolve("infrastructure/kubernetes/base/services");
  const deploymentFiles = (await readdir(deployDir)).filter((name) => name.endsWith(".yaml"));
  const serviceFiles = (await readdir(serviceDir)).filter((name) => name.endsWith(".yaml"));

  const deploymentNames = [];
  const serviceNames = [];

  for (const file of deploymentFiles) {
    const docs = await loadYamlDocs(`${deployDir}/${file}`);
    for (const doc of docs) {
      if (doc?.kind === "Deployment" && typeof doc?.metadata?.name === "string") {
        deploymentNames.push(doc.metadata.name);
      }
    }
  }

  for (const file of serviceFiles) {
    const docs = await loadYamlDocs(`${serviceDir}/${file}`);
    for (const doc of docs) {
      if (doc?.kind === "Service" && typeof doc?.metadata?.name === "string") {
        serviceNames.push(doc.metadata.name);
      }
    }
  }

  const missingDeployments = expectedServices.filter((service) => !deploymentNames.includes(service));
  const missingServices = expectedServices.filter((service) => !serviceNames.includes(service));

  return {
    passed: missingDeployments.length === 0 && missingServices.length === 0,
    details: {
      deploymentCount: deploymentNames.length,
      serviceCount: serviceNames.length,
      missingDeployments,
      missingServices
    }
  };
};

const validateHelm = async () => {
  const chart = (await loadYamlDocs("infrastructure/helm/openaegis/Chart.yaml"))[0] ?? {};
  const values = (await loadYamlDocs("infrastructure/helm/openaegis/values.yaml"))[0] ?? {};
  const valuesServices = Array.isArray(values.services) ? values.services.map((item) => item?.name).filter(Boolean) : [];
  const missingInValues = expectedServices.filter((service) => !valuesServices.includes(service));

  return {
    passed: chart.apiVersion === "v2" && typeof chart.name === "string" && missingInValues.length === 0,
    details: {
      chartName: chart.name,
      chartApiVersion: chart.apiVersion,
      valuesServiceCount: valuesServices.length,
      missingInValues
    }
  };
};

const validateHardening = async () => {
  const deploymentDir = resolve("infrastructure/kubernetes/base/deployments");
  const deploymentFiles = (await readdir(deploymentDir)).filter((name) => name.endsWith(".yaml"));
  const deploymentFindings = [];

  for (const file of deploymentFiles) {
    const docs = await loadYamlDocs(`${deploymentDir}/${file}`);
    for (const doc of docs) {
      if (doc?.kind !== "Deployment") continue;

      const name = doc?.metadata?.name ?? file;
      const labels = doc?.spec?.template?.metadata?.labels ?? {};
      const containers = Array.isArray(doc?.spec?.template?.spec?.containers) ? doc.spec.template.spec.containers : [];
      const imageFindings = containers
        .map((container) => container?.image)
        .filter((image) => typeof image === "string")
        .filter((image) => image.includes(":latest") || image.endsWith("/"));
      const missingStartupProbe = containers.some((container) => !container?.startupProbe?.httpGet?.path || !container?.startupProbe?.httpGet?.port);
      const meshBound = labels["openaegis.io/mesh-participant"] === "true";

      if (imageFindings.length || missingStartupProbe || !meshBound) {
        deploymentFindings.push({
          name,
          imageFindings,
          missingStartupProbe,
          meshBound
        });
      }
    }
  }

  const compose = await readText("docker-compose.yml");
  const composeHasPlaintextSecrets =
    compose.includes("openaegis_password") ||
    compose.includes("openaegis_secret_key") ||
    compose.includes("openaegis_access_key");
  const composeUsesEnvFile = compose.includes("env_file:") && compose.includes(".env.example");
  const composeHasSafePlaceholders =
    compose.includes("${POSTGRES_PASSWORD:-change-me-local-postgres}") &&
    compose.includes("${MINIO_ROOT_USER:-change-me-local-access-key}") &&
    compose.includes("${MINIO_ROOT_PASSWORD:-change-me-local-secret-key}");

  const helmDeploymentTemplate = await readText("infrastructure/helm/openaegis/templates/deployments.yaml");
  const helmValues = (await loadYamlDocs("infrastructure/helm/openaegis/values.yaml"))[0] ?? {};
  const helmImageTag = helmValues?.global?.imageTag;
  const helmHardening = {
    safeImageTag: helmImageTag && helmImageTag !== "latest",
    startupProbePresent: helmDeploymentTemplate.includes("startupProbe:"),
    meshLabelPresent: helmDeploymentTemplate.includes("openaegis.io/mesh-participant: \"true\"")
  };

  return {
    passed:
      deploymentFindings.length === 0 &&
      !composeHasPlaintextSecrets &&
      composeUsesEnvFile &&
      composeHasSafePlaceholders &&
      helmHardening.safeImageTag &&
      helmHardening.startupProbePresent &&
      helmHardening.meshLabelPresent,
    details: {
      deploymentFindings,
      composeHasPlaintextSecrets,
      composeUsesEnvFile,
      composeHasSafePlaceholders,
      helmHardening
    }
  };
};

const run = async () => {
  const dockerChecks = await Promise.all(expectedServices.map((service) => validateDockerfile(service)));
  const dockerFailures = dockerChecks.filter((check) => !check.passed);
  const k8s = await validateK8s();
  const helm = await validateHelm();
  const hardening = await validateHardening();

  const checks = [
    {
      checkId: "dockerfiles_runtime_entrypoints",
      passed: dockerFailures.length === 0,
      details: {
        total: dockerChecks.length,
        failures: dockerFailures.map((item) => item.service)
      }
    },
    {
      checkId: "kubernetes_base_manifests_complete",
      passed: k8s.passed,
      details: k8s.details
    },
    {
      checkId: "helm_chart_complete",
      passed: helm.passed,
      details: helm.details
    },
    {
      checkId: "infra_hardening_defaults",
      passed: hardening.passed,
      details: hardening.details
    }
  ];

  const passed = checks.filter((check) => check.passed).length;
  const scorePercent = Math.round((passed / checks.length) * 100);
  const report = {
    generatedAt: new Date().toISOString(),
    suite: "mvp-infra-validation",
    checks,
    summary: {
      totalChecks: checks.length,
      passedChecks: passed,
      failedChecks: checks.length - passed,
      scorePercent,
      status: scorePercent >= 98 ? "PASS" : "FAIL"
    }
  };

  console.log(JSON.stringify(report, null, 2));
  if (report.summary.status !== "PASS") process.exitCode = 1;
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
