import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const envPath = resolve(process.cwd(), ".env");

const parseEnvLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const separator = trimmed.indexOf("=");
  if (separator <= 0) return null;
  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return { key, value };
};

const loadDotEnv = () => {
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const entry = parseEnvLine(line);
    if (!entry) continue;
    if (typeof process.env[entry.key] === "undefined") {
      process.env[entry.key] = entry.value;
    }
  }
};

loadDotEnv();

const fromEnv = (key, fallback) => {
  const value = process.env[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
};

export const getCompanyProfile = () => {
  const companyName = fromEnv("OPENAEGIS_COMPANY_NAME", "GrumpyMan Distributors");
  const companyDomain = fromEnv("OPENAEGIS_COMPANY_DOMAIN", "grumpyman-distributors.com");
  const slug = slugify(companyName);
  const tenantId = fromEnv("OPENAEGIS_TENANT_ID", `tenant-${slug}`);

  const clinicianEmail = fromEnv("OPENAEGIS_CLINICIAN_EMAIL", `clinician@${companyDomain}`);
  const securityEmail = fromEnv("OPENAEGIS_SECURITY_EMAIL", `security@${companyDomain}`);
  const adminEmail = fromEnv("OPENAEGIS_ADMIN_EMAIL", `admin@${companyDomain}`);
  const workflowId = fromEnv("OPENAEGIS_WORKFLOW_ID", "wf-discharge-assistant");
  const patientId = fromEnv("OPENAEGIS_PATIENT_ID", "patient-1001");
  const useCaseName = fromEnv("OPENAEGIS_USE_CASE_NAME", `${companyName} Discharge Readiness Assistant`);
  const policyProfileName = fromEnv("OPENAEGIS_POLICY_PROFILE_NAME", `${companyName} Regulated Baseline`);

  const roleEmails = {
    platformAdmin: fromEnv("OPENAEGIS_PLATFORM_ADMIN_EMAIL", adminEmail),
    securityAdmin: fromEnv("OPENAEGIS_SECURITY_ADMIN_EMAIL", securityEmail),
    auditor: fromEnv("OPENAEGIS_AUDITOR_EMAIL", securityEmail),
    workflowOperator: fromEnv("OPENAEGIS_WORKFLOW_OPERATOR_EMAIL", clinicianEmail),
    approver: fromEnv("OPENAEGIS_APPROVER_EMAIL", securityEmail),
    analyst: fromEnv("OPENAEGIS_ANALYST_EMAIL", clinicianEmail)
  };

  const roleEmailFallbacks = {
    platformAdmin: [roleEmails.platformAdmin, adminEmail, securityEmail].filter(Boolean),
    securityAdmin: [roleEmails.securityAdmin, securityEmail, adminEmail].filter(Boolean),
    auditor: [roleEmails.auditor, securityEmail, adminEmail].filter(Boolean),
    workflowOperator: [roleEmails.workflowOperator, clinicianEmail, adminEmail].filter(Boolean),
    approver: [roleEmails.approver, securityEmail, adminEmail].filter(Boolean),
    analyst: [roleEmails.analyst, clinicianEmail, adminEmail].filter(Boolean)
  };

  return {
    companyName,
    companyDomain,
    tenantId,
    clinicianEmail,
    securityEmail,
    adminEmail,
    workflowId,
    patientId,
    useCaseName,
    policyProfileName,
    roleEmails,
    roleEmailFallbacks
  };
};
