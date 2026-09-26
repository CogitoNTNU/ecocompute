terraform {
  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "ecocomputetfstate1234"
    container_name       = "tfstate"
    key                  = "ecocompute.tfstate"
    use_azuread_auth     = true
  }
}
