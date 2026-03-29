package openaegis.authz

# Default deny. Policies must explicitly allow.
default allow := false

default require_approval := false

denied_reason[msg] {
  input.tenant_id == ""
  msg := "missing_tenant_context"
}

denied_reason[msg] {
  input.actor.assurance_level != "aal2"
  input.resource.classification == "EPHI"
  msg := "insufficient_authentication_assurance"
}

denied_reason[msg] {
  input.action == "model.infer"
  input.resource.classification == "EPHI"
  not input.route.zero_retention
  msg := "zero_retention_required"
}

denied_reason[msg] {
  input.action == "tool.execute"
  input.tool.network_profile != "none"
  not startswith(input.tool.network_profile, "allowlist:")
  msg := "network_profile_not_allowlisted"
}

allow {
  count(denied_reason) == 0
  input.action == "tool.read"
}

require_approval {
  input.risk_level == "high"
}

require_approval {
  input.risk_level == "critical"
}
