output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "registry_name" {
  value = azurerm_container_registry.main.name
}

output "app_urls" {
  value = { for name, app in azurerm_container_app.main : name => "https://${app.ingress[0].fqdn}" }
}

output "cost_resource_ids" {
  description = "Resource mapping for AZURE_COST_RESOURCES_JSON in local development."
  value       = local.cost_resources
}

output "frontend_url" {
  description = "Open the UI on always-on so browsing does not keep autoscale awake."
  value       = "https://${azurerm_container_app.main["always-on"].ingress[0].fqdn}"
}
