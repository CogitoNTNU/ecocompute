resource "random_string" "suffix" {
  length  = 6
  upper   = false
  numeric = true
  special = false
}

resource "azurerm_resource_group" "main" {
  name     = "ecocompute-rg-${random_string.suffix.result}"
  location = var.location
}

resource "azurerm_container_registry" "main" {
  name                = "ecocompute${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = true
}

resource "azurerm_container_app_environment" "main" {
  name                = "ecocompute"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
}

locals {
  apps = {
    autoscale = { min = 0, max = 3 }
    always-on = { min = 1, max = 1 }
  }

  backend_urls = {
    for name in keys(local.apps) : name => "https://ecocompute-${name}.${azurerm_container_app_environment.main.default_domain}"
  }

  cost_resources = {
    autoscale = ["${azurerm_resource_group.main.id}/providers/Microsoft.App/containerApps/ecocompute-autoscale"]
    always-on = ["${azurerm_resource_group.main.id}/providers/Microsoft.App/containerApps/ecocompute-always-on"]
    foundry   = var.foundry_resource_ids
    shared    = [azurerm_container_registry.main.id, azurerm_container_app_environment.main.id]
  }
}

data "azurerm_client_config" "current" {}

resource "azurerm_role_assignment" "cost_reader" {
  for_each = var.enable_cost_reporting ? local.apps : {}

  scope                = "/subscriptions/${data.azurerm_client_config.current.subscription_id}"
  role_definition_name = "Cost Management Reader"
  principal_id         = azurerm_container_app.main[each.key].identity[0].principal_id
}

resource "azurerm_container_app" "main" {
  for_each = local.apps

  name                         = "ecocompute-${each.key}"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"

  identity {
    type = "SystemAssigned"
  }

  secret {
    name  = "registry-password"
    value = azurerm_container_registry.main.admin_password
  }

  secret {
    name  = "foundry-key"
    value = var.azure_openai_api_key
  }

  registry {
    server               = azurerm_container_registry.main.login_server
    username             = azurerm_container_registry.main.admin_username
    password_secret_name = "registry-password"
  }

  template {
    min_replicas = each.value.min
    max_replicas = each.value.max

    http_scale_rule {
      name                = "http-requests"
      concurrent_requests = "10"
    }

    container {
      name   = "api"
      image  = "${azurerm_container_registry.main.login_server}/ecocompute:${var.image_tag}"
      cpu    = 0.25
      memory = "0.5Gi"

      readiness_probe {
        transport = "HTTP"
        port      = 8000
        path      = "/health"
      }

      liveness_probe {
        transport        = "HTTP"
        port             = 8000
        path             = "/health"
        initial_delay    = 10
        interval_seconds = 30
      }

      env {
        name  = "AZURE_OPENAI_BASE_URL"
        value = var.azure_openai_base_url
      }

      env {
        name  = "AZURE_OPENAI_DEPLOYMENT"
        value = var.azure_openai_nano_deployment
      }

      env {
        name  = "AZURE_OPENAI_LUNA_DEPLOYMENT"
        value = var.azure_openai_luna_deployment
      }

      env {
        name  = "BACKEND_MODE"
        value = each.key
      }

      env {
        name  = "BACKEND_URLS_JSON"
        value = jsonencode(local.backend_urls)
      }

      env {
        name  = "CORS_ORIGINS"
        value = join(",", var.additional_frontend_origins)
      }

      env {
        name  = "AZURE_COST_SUBSCRIPTION_ID"
        value = var.enable_cost_reporting ? data.azurerm_client_config.current.subscription_id : ""
      }

      env {
        name  = "AZURE_COST_RESOURCES_JSON"
        value = var.enable_cost_reporting ? jsonencode(local.cost_resources) : "{}"
      }

      env {
        name        = "AZURE_OPENAI_API_KEY"
        secret_name = "foundry-key"
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 8000

    ip_security_restriction {
      name             = "test-client"
      action           = "Allow"
      ip_address_range = var.allowed_ip_cidr
    }

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }
}
