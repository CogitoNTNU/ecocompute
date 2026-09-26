terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "ecocomputetfstate1234"
    container_name       = "tfstate"
    key                  = "ecocompute.tfstate"
    use_azuread_auth     = true
  }
}

provider "azurerm" {
  features {}
}

provider "random" {}
