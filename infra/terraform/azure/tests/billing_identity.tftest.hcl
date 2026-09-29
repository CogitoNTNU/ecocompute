# Both providers are mocked: these tests never contact Azure or use remote state.
mock_provider "azurerm" {
  mock_data "azurerm_client_config" {
    defaults = {
      subscription_id = "00000000-0000-0000-0000-000000000001"
    }
  }

  mock_resource "azurerm_container_app" {
    defaults = {
      # A user-assigned-only app has no system-assigned principal. Billing must
      # use the standalone identity, even when this output is null.
      identity = { principal_id = null, tenant_id = null }
    }
  }

  mock_resource "azurerm_container_app_environment" {
    defaults = {
      id             = "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/test-rg/providers/Microsoft.App/managedEnvironments/test-env"
      default_domain = "test.azurecontainerapps.io"
    }
  }

  override_resource {
    target = azurerm_user_assigned_identity.app["autoscale"]
    values = {
      id           = "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/test-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/ecocompute-autoscale"
      principal_id = "00000000-0000-0000-0000-000000000002"
      client_id    = "00000000-0000-0000-0000-000000000003"
    }
  }

  override_resource {
    target = azurerm_user_assigned_identity.app["always-on"]
    values = {
      id           = "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/test-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/ecocompute-always-on"
      principal_id = "00000000-0000-0000-0000-000000000004"
      client_id    = "00000000-0000-0000-0000-000000000005"
    }
  }
}

mock_provider "random" {}

variables {
  location               = "australiaeast"
  image_tag              = "test-image"
  azure_openai_api_key   = "test-only-not-a-real-key"
  entra_tenant_id        = "00000000-0000-0000-0000-000000000010"
  entra_client_id        = "00000000-0000-0000-0000-000000000011"
  entra_allowed_group_id = "00000000-0000-0000-0000-000000000012"
  foundry_resource_ids   = []
}

run "billing_uses_each_apps_standalone_identity" {
  command = apply

  variables {
    enable_cost_reporting = true
  }

  assert {
    condition = alltrue([
      for app in values(azurerm_container_app.main) :
      app.ingress[0].external_enabled &&
      length(app.ingress[0].ip_security_restriction) == 0 &&
      one([for env in app.template[0].container[0].env : env.value if env.name == "ENTRA_TENANT_ID"]) == var.entra_tenant_id &&
      one([for env in app.template[0].container[0].env : env.value if env.name == "ENTRA_CLIENT_ID"]) == var.entra_client_id &&
      one([for env in app.template[0].container[0].env : env.value if env.name == "ENTRA_ALLOWED_GROUP_ID"]) == var.entra_allowed_group_id
    ])
    error_message = "Both public ingress endpoints must require the same Entra configuration before paid APIs can be used."
  }

  assert {
    condition = alltrue([
      for name, app in azurerm_container_app.main :
      app.identity[0].type == "UserAssigned" &&
      app.identity[0].identity_ids == toset([azurerm_user_assigned_identity.app[name].id]) &&
      app.identity[0].principal_id == null
    ])
    error_message = "Each app must attach its own standalone identity without requiring a system-assigned principal."
  }

  assert {
    condition = alltrue([
      for name, app in azurerm_container_app.main :
      one([for env in app.template[0].container[0].env : env.value if env.name == "AZURE_CLIENT_ID"]) ==
      azurerm_user_assigned_identity.app[name].client_id
    ])
    error_message = "DefaultAzureCredential must select the identity attached to that app."
  }

  assert {
    condition = length(azurerm_role_assignment.cost_reader) == 2 && alltrue([
      for name, assignment in azurerm_role_assignment.cost_reader :
      assignment.principal_id == azurerm_user_assigned_identity.app[name].principal_id &&
      assignment.principal_type == "ServicePrincipal" &&
      assignment.role_definition_name == "Cost Management Reader" &&
      assignment.scope == "/subscriptions/00000000-0000-0000-0000-000000000001"
    ])
    error_message = "Both app identities must receive only the intended subscription billing role."
  }

  assert {
    condition = (
      azurerm_user_assigned_identity.app["autoscale"].principal_id !=
      azurerm_user_assigned_identity.app["always-on"].principal_id
    )
    error_message = "The backends must retain separate identities."
  }
}

run "billing_can_be_disabled" {
  command = apply

  variables {
    enable_cost_reporting = false
  }

  assert {
    condition     = length(azurerm_role_assignment.cost_reader) == 0
    error_message = "Disabling cost reporting must remove the billing role assignments."
  }

  assert {
    condition = alltrue([
      for app in values(azurerm_container_app.main) :
      one([for env in app.template[0].container[0].env : env.value if env.name == "AZURE_COST_SUBSCRIPTION_ID"]) == "" &&
      one([for env in app.template[0].container[0].env : env.value if env.name == "AZURE_COST_RESOURCES_JSON"]) == "{}"
    ])
    error_message = "Disabling cost reporting must also disable billing queries in both apps."
  }
}

run "first_rollout_keeps_existing_ip_rule" {
  command = apply

  variables {
    public_ingress  = false
    rollout_ip_cidr = "129.241.237.195/32"
  }

  assert {
    condition = alltrue([
      for app in values(azurerm_container_app.main) :
      length(app.ingress[0].ip_security_restriction) == 1 &&
      one(app.ingress[0].ip_security_restriction).ip_address_range == "129.241.237.195/32"
    ])
    error_message = "The first rollout must retain the old rule while it deploys the authenticated image."
  }
}
