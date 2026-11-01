variable "account_id" {
  description = "Cloudflare account that owns the Access applications."
  type        = string
  nullable    = false
}

variable "staging_hostname" {
  description = "Exact public hostname for the staging Worker."
  type        = string
  nullable    = false

  validation {
    condition     = !strcontains(var.staging_hostname, "/")
    error_message = "Provide a hostname only, without a path."
  }
}

variable "production_hostname" {
  description = "Exact public hostname for the production Worker."
  type        = string
  nullable    = false

  validation {
    condition     = !strcontains(var.production_hostname, "/")
    error_message = "Provide a hostname only, without a path."
  }
}

variable "owner_email" {
  description = "Single owner identity allowed to use the admin app."
  type        = string
  nullable    = false
}
