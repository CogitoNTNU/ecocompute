output "registry_name" {
  value = azurerm_container_registry.api.name
}

output "registry_server" {
  value = azurerm_container_registry.api.login_server
}

output "app_urls" {
  value = { for name, app in azurerm_container_app.api : name => "https://${app.ingress[0].fqdn}" }
}
