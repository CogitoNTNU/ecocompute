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
}

resource "azurerm_container_app" "main" {
  for_each = local.apps

  name                         = "ecocompute-${each.key}"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"

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

    container {
      name   = "api"
      image  = "${azurerm_container_registry.main.login_server}/ecocompute:${var.image_tag}"
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "AZURE_OPENAI_BASE_URL"
        value = "https://ecollm.openai.azure.com/openai/v1/"
      }

      env {
        name  = "AZURE_OPENAI_DEPLOYMENT"
        value = "gpt-4.1-nano"
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
