variable "location" {
  type = string
}

variable "image_tag" {
  type = string
}

variable "allowed_ip_cidr" {
  type = string
}

variable "azure_openai_api_key" {
  type      = string
  sensitive = true
}
