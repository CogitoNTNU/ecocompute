variable "location" {
  description = "Azure region for the comparison infrastructure."
  type        = string
}

variable "image_tag" {
  description = "Git commit SHA of the application image."
  type        = string
}

variable "public_ingress" {
  description = "Allow all source IPs after the authenticated image has been deployed behind the old restriction."
  type        = bool
  default     = true
}

variable "rollout_ip_cidr" {
  description = "Temporary existing client CIDR used only while staging authentication before opening ingress."
  type        = string
  default     = ""

  validation {
    condition     = var.rollout_ip_cidr == "" || (can(cidrnetmask(var.rollout_ip_cidr)) && !endswith(var.rollout_ip_cidr, "/0"))
    error_message = "Supply the existing restricted IPv4 CIDR, such as 129.241.237.195/32."
  }
}

variable "azure_openai_api_key" {
  type      = string
  sensitive = true
}

variable "entra_tenant_id" {
  description = "Microsoft Entra tenant that issues access tokens for NTNU members."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", var.entra_tenant_id))
    error_message = "Supply the NTNU Entra tenant ID as a UUID."
  }
}

variable "entra_client_id" {
  description = "Client ID of the multitenant EcoCompute SPA/API app registration in the project's Entra directory."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", var.entra_client_id))
    error_message = "Supply the Entra application client ID as a UUID."
  }
}

variable "entra_allowed_group_id" {
  description = "Optional NTNU Entra security group object ID for a narrower access policy."
  type        = string
  default     = ""

  validation {
    condition     = var.entra_allowed_group_id == "" || can(regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", var.entra_allowed_group_id))
    error_message = "Supply the optional authorized Entra group object ID as a UUID."
  }
}

variable "azure_openai_base_url" {
  description = "Shared Microsoft Foundry Responses API endpoint."
  type        = string
  default     = "https://ecollm.openai.azure.com/openai/v1/"
}

variable "foundry_models" {
  description = "Selectable Foundry deployments. Optional USD rates per million tokens are manually verified estimates, not billed costs."
  type = list(object({
    id                     = string
    label                  = string
    deployment             = string
    input_usd_per_million  = optional(number)
    output_usd_per_million = optional(number)
  }))
  default = []

  validation {
    condition = length(var.foundry_models) <= 100 && length(distinct([
      for model in var.foundry_models : model.id
      ])) == length(var.foundry_models) && alltrue([
      for model in var.foundry_models :
      can(regex("^[a-z0-9][a-z0-9._-]{0,63}$", model.id)) &&
      length(trimspace(model.label)) > 0 && length(trimspace(model.deployment)) > 0 &&
      (model.input_usd_per_million == null) == (model.output_usd_per_million == null) &&
      (model.input_usd_per_million == null || model.input_usd_per_million >= 0) &&
      (model.output_usd_per_million == null || model.output_usd_per_million >= 0)
    ])
    error_message = "Use unique lowercase model IDs, names and deployments; provide both nonnegative USD rates or neither."
  }
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
