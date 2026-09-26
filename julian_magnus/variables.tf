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

variable "image_tag" {
  type        = string
  description = "Tag of the backend image built by the deployment workflow."
}

variable "max_replicas" {
  type    = number
  default = 3

  validation {
    condition     = var.max_replicas >= 1 && var.max_replicas == floor(var.max_replicas)
    error_message = "max_replicas must be a positive whole number."
  }
}

variable "allowed_ip_cidr" {
  type        = string
  description = "Public IPv4 address/range allowed to call the test apps, e.g. 203.0.113.10/32."

  validation {
    condition     = can(cidrnetmask(var.allowed_ip_cidr)) && var.allowed_ip_cidr != "0.0.0.0/0"
    error_message = "Set a specific IPv4 CIDR range for the test client."
  }
}

variable "azure_openai_base_url" {
  type    = string
  default = "https://ecollm.openai.azure.com/openai/v1/"
}

variable "azure_openai_deployment" {
  type    = string
  default = "gpt-4.1-nano"
}

variable "azure_openai_api_key" {
  type      = string
  sensitive = true

  validation {
    condition     = length(trimspace(var.azure_openai_api_key)) > 0
    error_message = "Set the Foundry API key."
  }
}
