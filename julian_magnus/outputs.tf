output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "registry_name" {
  value = azurerm_container_registry.main.name
}

output "app_urls" {
  value = { for name, app in azurerm_container_app.main : name => "https://${app.ingress[0].fqdn}" }
}
