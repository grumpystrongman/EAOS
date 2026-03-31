import { useEffect, useMemo, useState } from "react";
import {
  isBrokerReference,
  pilotApi,
  PLUGIN_AUTH_MODE_LABELS,
  PLUGIN_CATEGORY_LABELS,
  type PluginAuthMode,
  type PluginCatalogEntry,
  type PluginConnectionTestResult,
  type PluginInstanceRecord
} from "../../shared/api/pilot.js";
import { usePilotWorkspace } from "../pilot-workspace.js";
import { Badge, EmptyState, JsonBlock, KeyValueList, Panel, PageHeader } from "../ui.js";

const INSTANCE_STORAGE_KEY = "openaegis.admin-console.integration-hub.instances";
const CATEGORY_ORDER = ["clinical", "data", "analytics", "collaboration", "operations"] as const;

const authModeTone = (authMode: PluginAuthMode) =>
  authMode === "oauth"
    ? "info"
    : authMode === "service-principal"
      ? "success"
      : authMode === "key-pair"
        ? "warning"
        : "default";

const instanceTone = (status: PluginInstanceRecord["status"]) =>
  status === "authorized" || status === "connected"
    ? "success"
    : status === "testing"
      ? "warning"
      : status === "failed"
        ? "danger"
        : "default";

const testTone = (status: PluginConnectionTestResult["status"]) =>
  status === "passed" ? "success" : status === "warning" ? "warning" : "danger";

const pluginStatusLabel = (status: PluginInstanceRecord["status"]) =>
  status === "authorized"
    ? "Authorized"
    : status === "connected"
      ? "Connected"
      : status === "testing"
        ? "Testing"
        : status === "failed"
          ? "Failed"
          : "Draft";

const emptyDraft = (catalog?: PluginCatalogEntry): Record<string, string> =>
  Object.fromEntries((catalog?.setupFields ?? []).map((field) => [field.key, ""])) as Record<string, string>;

const loadStoredInstances = (): PluginInstanceRecord[] => {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(INSTANCE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PluginInstanceRecord[]) : [];
  } catch {
    return [];
  }
};

const mergeInstances = (primary: PluginInstanceRecord[], secondary: PluginInstanceRecord[]) => {
  const byId = new Map<string, PluginInstanceRecord>();
  for (const instance of primary) byId.set(instance.toolId, instance);
  for (const instance of secondary) {
    const current = byId.get(instance.toolId);
    byId.set(instance.toolId, current ? { ...current, ...instance, config: { ...current.config, ...instance.config } } : instance);
  }
  return Array.from(byId.values()).sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
};

const latestInstanceForCatalog = (instances: PluginInstanceRecord[], catalogToolId: string) =>
  instances.find((instance) => instance.catalogToolId === catalogToolId) ?? null;

const fieldValue = (values: Record<string, string>, key: string) => values[key] ?? "";

export const IntegrationHubPage = () => {
  const clinicianSession = usePilotWorkspace((state) => state.clinicianSession);
  const securitySession = usePilotWorkspace((state) => state.securitySession);
  const connectDemoUsers = usePilotWorkspace((state) => state.connectDemoUsers);
  const isSyncing = usePilotWorkspace((state) => state.isSyncing);

  const [catalog, setCatalog] = useState<PluginCatalogEntry[]>([]);
  const [instances, setInstances] = useState<PluginInstanceRecord[]>(() => loadStoredInstances());
  const [selectedCategory, setSelectedCategory] = useState<(typeof CATEGORY_ORDER)[number] | "all">("all");
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [instanceName, setInstanceName] = useState("");
  const [banner, setBanner] = useState<{ tone: "info" | "warning" | "error"; text: string } | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [instanceBusyId, setInstanceBusyId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<PluginConnectionTestResult | null>(null);

  const token = securitySession?.accessToken ?? clinicianSession?.accessToken;
  const actorId = securitySession?.user.userId ?? clinicianSession?.user.userId ?? undefined;
  const hasActor = Boolean(actorId);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(INSTANCE_STORAGE_KEY, JSON.stringify(instances));
  }, [instances]);

  const refreshCatalog = async () => {
    setCatalogLoading(true);
    setBanner(null);
    try {
      const [catalogItems, remoteInstances] = await Promise.all([
        pilotApi.listPluginCatalog(token),
        pilotApi.listPluginInstances(token)
      ]);

      setCatalog(catalogItems);
      setInstances((current) => mergeInstances(remoteInstances, mergeInstances(current, loadStoredInstances())));

      if (!selectedCatalogId && catalogItems.length > 0) {
        setSelectedCatalogId(catalogItems[0]!.toolId);
        setSelectedCategory(catalogItems[0]!.category);
      }
    } catch (error) {
      setBanner({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to load plugin catalog."
      });
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    void refreshCatalog();
  }, [token]);

  const categories = useMemo(
    () =>
      Array.from(new Set(catalog.map((entry) => entry.category))).sort(
        (left, right) => CATEGORY_ORDER.indexOf(left as (typeof CATEGORY_ORDER)[number]) - CATEGORY_ORDER.indexOf(right as (typeof CATEGORY_ORDER)[number])
      ),
    [catalog]
  );

  const visibleCatalog = useMemo(
    () =>
      catalog.filter((entry) => (selectedCategory === "all" ? true : entry.category === selectedCategory)).sort((left, right) =>
        left.displayName.localeCompare(right.displayName)
      ),
    [catalog, selectedCategory]
  );

  const selectedCatalog = useMemo(
    () => catalog.find((entry) => entry.toolId === selectedCatalogId) ?? null,
    [catalog, selectedCatalogId]
  );

  const selectedInstance = useMemo(() => {
    if (!selectedCatalog) return null;
    return (
      instances.find((instance) => instance.toolId === selectedInstanceId) ??
      latestInstanceForCatalog(instances, selectedCatalog.toolId)
    );
  }, [instances, selectedCatalog, selectedInstanceId]);

  const draftValidation = useMemo(() => {
    if (!selectedCatalog) return { missingFields: [], invalidSecretFields: [] };
    const missingFields = selectedCatalog.setupFields.filter((field) => field.required && !fieldValue(draftValues, field.key).trim());
    const invalidSecretFields = selectedCatalog.setupFields.filter((field) => {
      if (!field.secret) return false;
      const value = fieldValue(draftValues, field.key).trim();
      return value.length > 0 && !isBrokerReference(value);
    });
    return { missingFields, invalidSecretFields };
  }, [draftValues, selectedCatalog]);

  const configureSelection = (catalogEntry: PluginCatalogEntry) => {
    const currentInstance = latestInstanceForCatalog(instances, catalogEntry.toolId);
    setSelectedCatalogId(catalogEntry.toolId);
    setSelectedCategory(catalogEntry.category);
    setSelectedInstanceId(currentInstance?.toolId ?? null);
    setDraftValues(currentInstance?.config ?? emptyDraft(catalogEntry));
    setInstanceName(currentInstance?.displayName ?? `${catalogEntry.displayName} instance`);
    setTestResult(currentInstance?.lastTest ?? null);
    setBanner(null);
  };

  useEffect(() => {
    if (!selectedCatalog) {
      setDraftValues({});
      setInstanceName("");
      setSelectedInstanceId(null);
      return;
    }

    const currentInstance = latestInstanceForCatalog(instances, selectedCatalog.toolId);
    setSelectedInstanceId(currentInstance?.toolId ?? null);
    setDraftValues(currentInstance?.config ?? emptyDraft(selectedCatalog));
    setInstanceName(currentInstance?.displayName ?? `${selectedCatalog.displayName} instance`);
    setTestResult(currentInstance?.lastTest ?? null);
  }, [instances, selectedCatalog]);

  const saveInstance = async () => {
    if (!selectedCatalog) {
      setBanner({ tone: "warning", text: "Select a plugin catalog entry first." });
      return;
    }
    if (!hasActor || !actorId) {
      setBanner({
        tone: "warning",
        text: "Connect evaluator identities before creating plugin instances. Writes require an actor header."
      });
      return;
    }
    if (!instanceName.trim()) {
      setBanner({ tone: "warning", text: "Enter an instance name before creating the plugin instance." });
      return;
    }
    if (draftValidation.missingFields.length > 0) {
      setBanner({
        tone: "error",
        text: `Complete required fields first: ${draftValidation.missingFields.map((field) => field.label).join(", ")}`
      });
      return;
    }
    if (draftValidation.invalidSecretFields.length > 0) {
      setBanner({
        tone: "error",
        text: `Secret inputs must use broker references: ${draftValidation.invalidSecretFields.map((field) => field.label).join(", ")}`
      });
      return;
    }

    setInstanceBusyId(selectedCatalog.toolId);
    try {
      const instance = await pilotApi.createPluginInstance(token, actorId, {
        catalogToolId: selectedCatalog.toolId,
        instanceName: instanceName.trim(),
        config: Object.fromEntries(
          Object.entries(draftValues).map(([key, value]) => [key, value.trim()])
        )
      });

      const persisted: PluginInstanceRecord = {
        ...instance,
        config: Object.fromEntries(Object.entries(draftValues).map(([key, value]) => [key, value.trim()])),
        status: "draft",
        updatedAt: new Date().toISOString()
      };

      setInstances((current) => mergeInstances([persisted, ...current], []));
      setSelectedInstanceId(instance.toolId);
      setBanner({
        tone: "info",
        text: "Draft plugin instance created. Authorize OAuth-capable plugins before running live checks."
      });
    } catch (error) {
      setBanner({ tone: "error", text: error instanceof Error ? error.message : "Unable to create plugin instance." });
    } finally {
      setInstanceBusyId(null);
    }
  };

  const authorizeInstance = async (instance: PluginInstanceRecord) => {
    if (!hasActor || !actorId) {
      setBanner({
        tone: "warning",
        text: "Connect evaluator identities before authorizing OAuth-capable plugins."
      });
      return;
    }

    setInstanceBusyId(instance.toolId);
    try {
      const updated = await pilotApi.authorizePluginInstance(token, actorId, instance);
      setInstances((current) =>
        mergeInstances(
          [
            {
              ...instance,
              ...updated,
              status: "authorized",
              updatedAt: updated.updatedAt,
              publishedAt: updated.publishedAt ?? updated.updatedAt
            }
          ],
          current
        )
      );
      setSelectedInstanceId(instance.toolId);
      setBanner({
        tone: "info",
        text: "OAuth authorization complete. The plugin instance can now be tested."
      });
    } catch (error) {
      setBanner({ tone: "error", text: error instanceof Error ? error.message : "Authorization failed." });
    } finally {
      setInstanceBusyId(null);
    }
  };

  const testInstance = async (instance: PluginInstanceRecord) => {
    setInstanceBusyId(instance.toolId);
    try {
      const result = await pilotApi.testPluginConnection(token, instance);
      setTestResult(result);
      setInstances((current) =>
        current.map((item) =>
          item.toolId === instance.toolId
            ? {
                ...item,
                lastTest: result,
                status: result.status === "passed" ? "connected" : result.status === "warning" ? "authorized" : "failed",
                updatedAt: new Date().toISOString()
              }
            : item
        )
      );
      setBanner({
        tone: result.status === "failed" ? "error" : "info",
        text: result.summary
      });
    } catch (error) {
      setBanner({ tone: "error", text: error instanceof Error ? error.message : "Connection test failed." });
    } finally {
      setInstanceBusyId(null);
    }
  };

  const catalogGroups = useMemo(() => {
    const groups = new Map<string, PluginCatalogEntry[]>();
    for (const entry of catalog) {
      const bucket = groups.get(entry.category) ?? [];
      bucket.push(entry);
      groups.set(entry.category, bucket);
    }
    return CATEGORY_ORDER.flatMap((category) => [
      {
        category,
        items: (groups.get(category) ?? []).sort((left, right) => left.displayName.localeCompare(right.displayName))
      }
    ]).filter((group) => group.items.length > 0);
  }, [catalog]);

  const selectedInstanceChecks = selectedInstance?.lastTest?.checks ?? [];
  const visibleInstances = useMemo(() => instances.filter((instance) => !selectedCatalogId || instance.catalogToolId === selectedCatalogId), [instances, selectedCatalogId]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Enterprise connectivity"
        title="Integration Hub"
        subtitle="Browse published plugin catalog entries, create broker-backed instances, authorize OAuth flows, and test connection state without exposing raw secrets."
        actions={
          <>
            <Badge tone={hasActor ? "success" : "warning"}>{hasActor ? `Actor ${actorId}` : "Connect identities to write"}</Badge>
            <button type="button" className="primary" onClick={() => void connectDemoUsers()} disabled={isSyncing}>
              {clinicianSession && securitySession ? "Reconnect identities" : "Connect evaluator identities"}
            </button>
            <button type="button" onClick={() => void refreshCatalog()} disabled={catalogLoading || isSyncing}>
              {catalogLoading ? "Refreshing..." : "Refresh catalog"}
            </button>
          </>
        }
      />

      {banner ? <div className={`banner ${banner.tone}`}>{banner.text}</div> : null}

      <section className="split-grid">
        <Panel
          title="Plugin catalog"
          subtitle="Browse published tool-registry manifests by category and auth mode."
          actions={<Badge tone="info">{catalog.length} published plugins</Badge>}
        >
          <div className="pill-row" style={{ marginBottom: "1rem" }}>
            <button type="button" className={selectedCategory === "all" ? "primary" : ""} onClick={() => setSelectedCategory("all")}>
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={selectedCategory === category ? "primary" : ""}
                onClick={() => setSelectedCategory(category)}
              >
                {PLUGIN_CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>

          <div className="stack">
            {catalogGroups.length === 0 ? (
              <EmptyState
                title="No plugin catalog entries loaded"
                description="Refresh the catalog after connecting identities, or verify that the tool-registry service is reachable."
              />
            ) : (
              visibleCatalog.map((entry) => {
                const active = entry.toolId === selectedCatalogId;
                return (
                  <button
                    key={entry.toolId}
                    type="button"
                    className={active ? "scenario-card active" : "scenario-card"}
                    onClick={() => configureSelection(entry)}
                  >
                    <strong>{entry.displayName}</strong>
                    <p>{entry.description}</p>
                    <div className="pill-row">
                      <Badge tone="info">{entry.categoryLabel}</Badge>
                      <Badge tone={authModeTone(entry.authMode)}>{entry.authModeLabel}</Badge>
                      <Badge tone={entry.supportsOAuth ? "warning" : "default"}>{entry.supportsOAuth ? "OAuth-capable" : "Brokered"}</Badge>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {catalogGroups.length > 0 ? (
            <div className="stack" style={{ marginTop: "1rem" }}>
              {catalogGroups.map((group) => (
                <article key={group.category} className="policy-impact-row">
                  <div className="policy-impact-head">
                    <strong>{PLUGIN_CATEGORY_LABELS[group.category]}</strong>
                    <Badge tone="info">{group.items.length}</Badge>
                  </div>
                  <p>
                    {group.items.map((item) => item.displayName).join(", ")}
                  </p>
                </article>
              ))}
            </div>
          ) : null}
        </Panel>

        <Panel
          title="Instance setup"
          subtitle="Create a plugin instance using broker references only for secret inputs."
          actions={selectedCatalog ? <Badge tone={selectedCatalog.supportsOAuth ? "warning" : "success"}>{selectedCatalog.authModeLabel}</Badge> : undefined}
        >
          {selectedCatalog ? (
            <div className="stack">
              <KeyValueList
                items={[
                  { label: "Catalog plugin", value: selectedCatalog.displayName },
                  { label: "Category", value: selectedCatalog.categoryLabel },
                  { label: "Auth mode", value: selectedCatalog.authModeLabel },
                  { label: "Trust tier", value: selectedCatalog.trustTier },
                  { label: "Broker-only secrets", value: selectedCatalog.brokerOnlySecrets.join(", ") || "none" }
                ]}
              />

              <div className="pill-row">
                {selectedCatalog.safetyNotes.map((note) => (
                  <Badge key={note} tone="warning">
                    {note}
                  </Badge>
                ))}
              </div>

              <label className="form-field">
                <span>Instance name</span>
                <input value={instanceName} onChange={(event) => setInstanceName(event.target.value)} placeholder={`${selectedCatalog.displayName} instance`} />
              </label>

              <div className="stack">
                {selectedCatalog.setupFields.map((field) => {
                  const value = fieldValue(draftValues, field.key);
                  const invalid = field.secret ? value.trim().length > 0 && !isBrokerReference(value) : false;
                  return (
                    <label key={field.key} className="form-field">
                      <span>
                        {field.label}
                        {field.secret ? " (broker ref only)" : ""}
                      </span>
                      <input
                        type="text"
                        value={value}
                        placeholder={field.placeholder}
                        onChange={(event) =>
                          setDraftValues((current) => ({
                            ...current,
                            [field.key]: event.target.value
                          }))
                        }
                      />
                      {field.helper ? <small>{field.helper}</small> : null}
                      {field.secret ? (
                        invalid ? (
                          <small className="warning-copy">
                            Invalid secret format. Use a secrets-broker reference such as <code>vault://secret/path</code>.
                          </small>
                        ) : (
                          <small>Secret material is never entered directly. Use a broker reference only.</small>
                        )
                      ) : null}
                    </label>
                  );
                })}
              </div>

              {draftValidation.missingFields.length > 0 || draftValidation.invalidSecretFields.length > 0 ? (
                <div className="warning-copy">
                  {draftValidation.missingFields.length > 0 ? (
                    <div>Missing required fields: {draftValidation.missingFields.map((field) => field.label).join(", ")}.</div>
                  ) : null}
                  {draftValidation.invalidSecretFields.length > 0 ? (
                    <div>Invalid secret refs: {draftValidation.invalidSecretFields.map((field) => field.label).join(", ")}.</div>
                  ) : null}
                </div>
              ) : null}

              <div className="pill-row">
                <button type="button" className="primary" onClick={() => void saveInstance()} disabled={catalogLoading || instanceBusyId === selectedCatalog.toolId || !selectedCatalog}>
                  Create instance
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftValues(emptyDraft(selectedCatalog));
                    setInstanceName(`${selectedCatalog.displayName} instance`);
                    setTestResult(null);
                    setBanner({
                      tone: "info",
                      text: "Draft reset to empty broker-backed inputs."
                    });
                  }}
                >
                  Reset draft
                </button>
              </div>

              {selectedInstance ? (
                <div className="policy-impact-row">
                  <div className="policy-impact-head">
                    <strong>Selected instance</strong>
                    <Badge tone={instanceTone(selectedInstance.status)}>{pluginStatusLabel(selectedInstance.status)}</Badge>
                  </div>
                  <p>{selectedInstance.toolId}</p>
                  <div className="pill-row">
                    {selectedCatalog.supportsOAuth ? (
                      <button type="button" onClick={() => void authorizeInstance(selectedInstance)} disabled={instanceBusyId === selectedInstance.toolId}>
                        Authorize OAuth
                      </button>
                    ) : null}
                    <button type="button" className="primary" onClick={() => void testInstance(selectedInstance)} disabled={instanceBusyId === selectedInstance.toolId}>
                      Test connection
                    </button>
                  </div>
                </div>
              ) : selectedCatalog.supportsOAuth ? (
                <div className="warning-copy">
                  OAuth-capable plugins need an explicit authorize action after creation and before the first test.
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="Select a plugin to start setup"
              description="Choose a catalog entry to load its setup fields, auth mode, and broker-only secret requirements."
            />
          )}
        </Panel>
      </section>

      <section className="split-grid">
        <Panel title="Safety contract" subtitle="OpenAegis keeps secrets brokered, authorization explicit, and tests visible.">
          <ol className="plain-steps">
            <li>Use only published catalog entries from tool-registry.</li>
            <li>Enter broker references for secret inputs, not raw keys, tokens, or private material.</li>
            <li>Authorize OAuth-capable plugins before promoting them to live usage.</li>
            <li>Run connection tests and review warnings before allowing any downstream automation.</li>
          </ol>
          <div className="pill-row">
            <Badge tone="success">Broker references only</Badge>
            <Badge tone="warning">Explicit authorization</Badge>
            <Badge tone="info">Visible test results</Badge>
          </div>
        </Panel>

        <Panel title="Test result" subtitle="The latest connection test is displayed here with plain-language findings.">
          {testResult ? (
            <div className="stack">
              <KeyValueList
                items={[
                  { label: "Status", value: <Badge tone={testTone(testResult.status)}>{testResult.status}</Badge> },
                  { label: "Summary", value: testResult.summary },
                  { label: "Checked at", value: new Date(testResult.checkedAt).toLocaleString() }
                ]}
              />
              {testResult.warnings.length > 0 ? (
                <div className="stack">
                  {testResult.warnings.map((warning) => (
                    <div key={warning} className="hint-row">
                      <Badge tone="warning">Warning</Badge>
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="stack">
                {testResult.checks.map((check) => (
                  <article key={check.label} className="policy-impact-row">
                    <div className="policy-impact-head">
                      <strong>{check.label}</strong>
                      <Badge tone={check.tone}>{check.tone}</Badge>
                    </div>
                    <p>{check.detail}</p>
                  </article>
                ))}
              </div>
              <JsonBlock value={testResult} />
            </div>
          ) : (
            <EmptyState
              title="No test result yet"
              description="Create or select a plugin instance, then run Test connection to see explicit pass, warning, or failure feedback."
            />
          )}
        </Panel>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Plugin instances</h3>
            <p className="panel-subtitle">Draft and authorized instances are persisted locally and mirrored through the registry route.</p>
          </div>
          <Badge tone="info">{visibleInstances.length} visible</Badge>
        </div>

        <div className="stack">
          {visibleInstances.length === 0 ? (
            <EmptyState
              title="No instances yet"
              description="Create an instance from the selected plugin catalog entry. OAuth-capable plugins will need explicit authorization."
            />
          ) : (
            visibleInstances.map((instance) => (
              <article key={instance.toolId} className="policy-impact-row">
                <div className="policy-impact-head">
                  <strong>{instance.displayName}</strong>
                  <Badge tone={instanceTone(instance.status)}>{pluginStatusLabel(instance.status)}</Badge>
                </div>
                <p>{instance.toolId}</p>
                <KeyValueList
                  items={[
                    { label: "Catalog plugin", value: instance.catalogToolId },
                    { label: "Category", value: instance.categoryLabel },
                    { label: "Auth mode", value: instance.authModeLabel },
                    { label: "Last test", value: instance.lastTest ? `${instance.lastTest.status} - ${instance.lastTest.summary}` : "Not tested yet" }
                  ]}
                />
                <div className="pill-row">
                  <button
                    type="button"
                    onClick={() => {
                      const catalogEntry = catalog.find((entry) => entry.toolId === instance.catalogToolId);
                      if (catalogEntry) {
                        setSelectedCatalogId(catalogEntry.toolId);
                        setSelectedCategory(catalogEntry.category);
                        setSelectedInstanceId(instance.toolId);
                        setDraftValues(instance.config);
                        setInstanceName(instance.displayName);
                        setTestResult(instance.lastTest ?? null);
                      }
                    }}
                  >
                    Select
                  </button>
                  {instance.authMode === "oauth" ? (
                    <button type="button" onClick={() => void authorizeInstance(instance)} disabled={instanceBusyId === instance.toolId}>
                      Authorize OAuth
                    </button>
                  ) : null}
                  <button type="button" className="primary" onClick={() => void testInstance(instance)} disabled={instanceBusyId === instance.toolId}>
                    Test connection
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
