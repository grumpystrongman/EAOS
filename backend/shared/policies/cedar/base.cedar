permit(
  principal,
  action,
  resource
)
when {
  principal has tenant
  && resource has tenant
  && principal.tenant == resource.tenant
  && principal.assurance in ["aal2", "aal3"]
  && action in [Action::"ReadContext", Action::"ExecuteWorkflow"]
};

forbid(
  principal,
  action,
  resource
)
when {
  resource.classification == "EPHI"
  && action == Action::"SendToExternalModel"
  && !(resource.zeroRetention == true)
};

forbid(
  principal,
  action,
  resource
)
when {
  action == Action::"WritePersistentMemory"
  && !(resource.provenanceAttached == true)
};