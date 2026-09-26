variable "location" {
  description = "Azure region for the comparison infrastructure."
  type        = string
}

variable "image_tag" {
  description = "Git commit SHA of the application image."
  type        = string
}

variable "allowed_ip_cidr" {
  description = "Public client CIDR allowed to reach the chat and billing endpoints."
  type        = string

  validation {
    condition     = can(cidrnetmask(var.allowed_ip_cidr)) && !endswith(var.allowed_ip_cidr, "/0")
    error_message = "Supply an IPv4 CIDR such as your public IP followed by /32; unrestricted access is not allowed."
  }
}

variable "azure_openai_api_key" {
  type      = string
  sensitive = true
}

variable "azure_openai_base_url" {
  description = "Shared Microsoft Foundry Responses API endpoint."
  type        = string
  default     = "https://ecollm.openai.azure.com/openai/v1/"
}

variable "azure_openai_nano_deployment" {
  type    = string
  default = "gpt-4.1-nano"
}

variable "azure_openai_luna_deployment" {
  type    = string
  default = "gpt-6-luna"
}

variable "enable_cost_reporting" {
  description = "Grant the app identities Cost Management Reader on this subscription and enable billing queries."
  type        = bool
  default     = true
}

variable "foundry_resource_ids" {
  description = "Foundry account resource IDs in this subscription to include in billed AI costs. Empty means Foundry costs are not connected."
  type        = list(string)
  default     = []
}

variable "additional_frontend_origins" {
  description = "Extra trusted origins for local development or a separately hosted frontend. Backend origins are included automatically."
  type        = list(string)
  default     = []
}
