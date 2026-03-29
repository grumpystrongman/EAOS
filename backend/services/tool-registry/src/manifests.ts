export type ToolAction = "READ" | "WRITE" | "EXECUTE";
export type ToolManifestStatus = "draft" | "published";
export type ConnectorTrustTier = "tier-1" | "tier-2" | "tier-3" | "tier-4";

export interface ToolManifestRecord {
  toolId: string;
  displayName: string;
  connectorType:
    | "microsoft-fabric"
    | "power-bi"
    | "sql"
    | "fhir"
    | "hl7"
    | "sharepoint"
    | "email"
    | "ticketing"
    | "project";
  description: string;
  version: string;
  trustTier: ConnectorTrustTier;
  allowedActions: ToolAction[];
  permissionScopes: string[];
  outboundDomains: string[];
  rateLimitPerMinute: number;
  idempotent: boolean;
  mockModeSupported: boolean;
  signature: string;
  signedBy: string;
  status: ToolManifestStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface ToolRegistryState {
  version: number;
  manifests: ToolManifestRecord[];
}

const now = () => new Date().toISOString();

const manifest = (input: Omit<ToolManifestRecord, "createdAt" | "updatedAt">): ToolManifestRecord => {
  const timestamp = now();
  return {
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

export const defaultManifests = (): ToolManifestRecord[] => [
  manifest({
    toolId: "connector-ms-fabric-read",
    displayName: "Microsoft Fabric Reader",
    connectorType: "microsoft-fabric",
    description: "Read-only workspace and Lakehouse query access for analytics workflows.",
    version: "1.0.0",
    trustTier: "tier-1",
    allowedActions: ["READ"],
    permissionScopes: ["fabric.workspace.read", "fabric.lakehouse.read"],
    outboundDomains: ["api.fabric.microsoft.com"],
    rateLimitPerMinute: 120,
    idempotent: true,
    mockModeSupported: true,
    signature: "sig-ms-fabric-v1",
    signedBy: "platform-security",
    status: "published",
    publishedAt: now()
  }),
  manifest({
    toolId: "connector-powerbi-export",
    displayName: "Power BI Export",
    connectorType: "power-bi",
    description: "Exports governed reports and dashboard snapshots for approved audiences.",
    version: "1.0.0",
    trustTier: "tier-2",
    allowedActions: ["READ", "EXECUTE"],
    permissionScopes: ["powerbi.report.read", "powerbi.export.execute"],
    outboundDomains: ["api.powerbi.com"],
    rateLimitPerMinute: 90,
    idempotent: true,
    mockModeSupported: true,
    signature: "sig-powerbi-v1",
    signedBy: "platform-security",
    status: "published",
    publishedAt: now()
  }),
  manifest({
    toolId: "connector-sql-careplan",
    displayName: "SQL Care Plan Reader",
    connectorType: "sql",
    description: "Reads structured care-plan and scheduling records from enterprise SQL.",
    version: "1.0.0",
    trustTier: "tier-1",
    allowedActions: ["READ"],
    permissionScopes: ["sql.careplan.read"],
    outboundDomains: ["sql.internal.local"],
    rateLimitPerMinute: 300,
    idempotent: true,
    mockModeSupported: true,
    signature: "sig-sql-v1",
    signedBy: "platform-security",
    status: "published",
    publishedAt: now()
  }),
  manifest({
    toolId: "connector-fhir-read",
    displayName: "FHIR Clinical Reader",
    connectorType: "fhir",
    description: "Retrieves patient resources under purpose-of-use restrictions.",
    version: "1.0.0",
    trustTier: "tier-1",
    allowedActions: ["READ"],
    permissionScopes: ["fhir.patient.read", "fhir.encounter.read"],
    outboundDomains: ["fhir.hospital.local"],
    rateLimitPerMinute: 240,
    idempotent: true,
    mockModeSupported: true,
    signature: "sig-fhir-v1",
    signedBy: "platform-security",
    status: "published",
    publishedAt: now()
  }),
  manifest({
    toolId: "connector-hl7-ingest",
    displayName: "HL7 Interface Ingest",
    connectorType: "hl7",
    description: "Processes HL7 feed messages in constrained runtime channels.",
    version: "1.0.0",
    trustTier: "tier-1",
    allowedActions: ["READ", "EXECUTE"],
    permissionScopes: ["hl7.message.read", "hl7.interface.execute"],
    outboundDomains: ["hl7.integration.local"],
    rateLimitPerMinute: 180,
    idempotent: true,
    mockModeSupported: true,
    signature: "sig-hl7-v1",
    signedBy: "platform-security",
    status: "published",
    publishedAt: now()
  }),
  manifest({
    toolId: "connector-sharepoint-docs",
    displayName: "SharePoint Governance Connector",
    connectorType: "sharepoint",
    description: "Reads policy playbooks and governed runbook documents.",
    version: "1.0.0",
    trustTier: "tier-2",
    allowedActions: ["READ"],
    permissionScopes: ["sharepoint.docs.read"],
    outboundDomains: ["graph.microsoft.com"],
    rateLimitPerMinute: 120,
    idempotent: true,
    mockModeSupported: true,
    signature: "sig-sharepoint-v1",
    signedBy: "platform-security",
    status: "published",
    publishedAt: now()
  }),
  manifest({
    toolId: "connector-email-notify",
    displayName: "Outbound Email Notifier",
    connectorType: "email",
    description: "Sends approved outbound notifications with DLP redaction controls.",
    version: "1.0.0",
    trustTier: "tier-2",
    allowedActions: ["EXECUTE"],
    permissionScopes: ["email.send.outbound"],
    outboundDomains: ["smtp.enterprise.local"],
    rateLimitPerMinute: 60,
    idempotent: true,
    mockModeSupported: true,
    signature: "sig-email-v1",
    signedBy: "platform-security",
    status: "published",
    publishedAt: now()
  }),
  manifest({
    toolId: "connector-ticketing-ops",
    displayName: "Incident Ticketing Connector",
    connectorType: "ticketing",
    description: "Creates and updates incident tickets with policy-linked metadata.",
    version: "1.0.0",
    trustTier: "tier-2",
    allowedActions: ["READ", "WRITE", "EXECUTE"],
    permissionScopes: ["ticket.read", "ticket.write", "ticket.transition"],
    outboundDomains: ["tickets.enterprise.local"],
    rateLimitPerMinute: 80,
    idempotent: true,
    mockModeSupported: true,
    signature: "sig-ticketing-v1",
    signedBy: "platform-security",
    status: "published",
    publishedAt: now()
  }),
  manifest({
    toolId: "connector-linear-project",
    displayName: "Linear Project Connector",
    connectorType: "project",
    description: "Creates and tracks execution, incident, and tranche tasks in Linear.",
    version: "1.0.0",
    trustTier: "tier-3",
    allowedActions: ["READ", "WRITE", "EXECUTE"],
    permissionScopes: ["linear.issue.read", "linear.issue.write", "linear.comment.write"],
    outboundDomains: ["api.linear.app"],
    rateLimitPerMinute: 70,
    idempotent: true,
    mockModeSupported: true,
    signature: "sig-linear-v1",
    signedBy: "platform-security",
    status: "published",
    publishedAt: now()
  })
];

export const defaultRegistryState = (): ToolRegistryState => ({
  version: 1,
  manifests: defaultManifests()
});
