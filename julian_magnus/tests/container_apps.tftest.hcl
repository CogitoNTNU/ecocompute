mock_provider "azurerm" {}

variables {
  resource_group_name  = "ecocompute-test"
  subscription_id      = "00000000-0000-0000-0000-000000000001"
  tenant_id            = "00000000-0000-0000-0000-000000000002"
  image_tag            = "test"
  allowed_ip_cidr      = "203.0.113.10/32"
  azure_openai_api_key = "test-key-not-a-real-secret"
}

run "compare_scaling" {
  command = plan

  assert {
    condition = (
      azurerm_container_app.api["autoscale"].template[0].min_replicas == 0 &&
      azurerm_container_app.api["autoscale"].template[0].max_replicas == 3 &&
      azurerm_container_app.api["always_on"].template[0].min_replicas == 1 &&
      azurerm_container_app.api["always_on"].template[0].max_replicas == 1
    )
    error_message = "The experiment needs one scaling app and one fixed replica."
  }

  assert {
    condition = alltrue([
      for app in azurerm_container_app.api :
      app.template[0].container[0].cpu == 0.25 &&
      app.template[0].container[0].memory == "0.5Gi" &&
      app.revision_mode == "Single" &&
      one(app.ingress[0].ip_security_restriction).ip_address_range == var.allowed_ip_cidr
    ])
    error_message = "Both apps must have the same size, one revision and restricted access."
  }
}

run "change_scaling_limit" {
  command = plan

  variables {
    max_replicas = 7
  }

  assert {
    condition = (
      azurerm_container_app.api["autoscale"].template[0].max_replicas == 7 &&
      azurerm_container_app.api["always_on"].template[0].max_replicas == 1
    )
    error_message = "Changing the scaling limit must not change the baseline."
  }
}

run "reject_public_access" {
  command = plan

  variables {
    allowed_ip_cidr = "0.0.0.0/0"
  }

  expect_failures = [var.allowed_ip_cidr]
}

run "reject_empty_key" {
  command = plan

  variables {
    azure_openai_api_key = ""
  }

  expect_failures = [var.azure_openai_api_key]
}
