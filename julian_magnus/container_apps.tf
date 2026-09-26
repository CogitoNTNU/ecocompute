resource "azurerm_container_registry" "api" {
  name                = "ecocompute${substr(md5(azurerm_resource_group.example.id), 0, 8)}"
  resource_group_name = azurerm_resource_group.example.name
  location            = azurerm_resource_group.example.location
  sku                 = "Basic"
  admin_enabled       = false
}

resource "azurerm_user_assigned_identity" "image_pull" {
  name                = "ecocompute-image-pull"
  resource_group_name = azurerm_resource_group.example.name
  location            = azurerm_resource_group.example.location
}

resource "azurerm_role_assignment" "image_pull" {
  scope                = azurerm_container_registry.api.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.image_pull.principal_id
}

resource "azurerm_container_app_environment" "api" {
  name                = "ecocompute"
  resource_group_name = azurerm_resource_group.example.name
  location            = azurerm_resource_group.example.location

  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
    minimum_count         = 0
    maximum_count         = 0
  }
}

resource "azurerm_container_app" "api" {
  for_each = {
    autoscale = { min = 0, max = var.max_replicas }
    always_on = { min = 1, max = 1 }
  }

  name                         = "ecocompute-${replace(each.key, "_", "-")}"
  resource_group_name          = azurerm_resource_group.example.name
  container_app_environment_id = azurerm_container_app_environment.api.id
  revision_mode                = "Single"
  tags                         = { experiment = each.key }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.image_pull.id]
  }

  registry {
    server   = azurerm_container_registry.api.login_server
    identity = azurerm_user_assigned_identity.image_pull.id
  }

  secret {
    name  = "foundry-api-key"
    value = var.azure_openai_api_key
  }

  template {
    min_replicas = each.value.min
    max_replicas = each.value.max

    http_scale_rule {
      name                = "http"
      concurrent_requests = "10"
    }

    container {
      name   = "api"
      image  = "${azurerm_container_registry.api.login_server}/ecocompute:${var.image_tag}"
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "AZURE_OPENAI_BASE_URL"
        value = var.azure_openai_base_url
      }

      env {
        name  = "AZURE_OPENAI_DEPLOYMENT"
        value = var.azure_openai_deployment
      }

      env {
        name        = "AZURE_OPENAI_API_KEY"
        secret_name = "foundry-api-key"
      }

      readiness_probe {
        transport = "HTTP"
        port      = 8000
        path      = "/health"
      }

      liveness_probe {
        transport = "HTTP"
        port      = 8000
        path      = "/health"
      }
    }
  }

  ingress {
    external_enabled           = true
    allow_insecure_connections = false
    target_port                = 8000

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

  depends_on = [azurerm_role_assignment.image_pull]
}
