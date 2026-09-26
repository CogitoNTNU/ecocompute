variable "resource_group_name" {
  type        = string
  description = "The name of the resource group."
}

variable "subscription_id" {
  type        = string
  description = "The Azure subscription ID."
}

variable "tenant_id" {
  type        = string
  description = "The Microsoft Entra tenant ID."
}

variable "location" {
  type = string
}

variable "address_prefixes" {
  type = string
}

variable "subnet_name" {
  type = string
}

variable "address_space" {
  type = list(string)
}
