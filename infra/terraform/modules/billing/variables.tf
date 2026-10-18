variable "project_id" {
  type        = string
  description = "GCP project id. The budget filters to this project's number."
}

variable "billing_account_id" {
  type        = string
  description = "Billing account id (XXXXXX-XXXXXX-XXXXXX). Not a secret."

  validation {
    condition     = can(regex("^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$", var.billing_account_id))
    error_message = "billing_account_id must look like 012345-6789AB-CDEF01."
  }
}

variable "display_name" {
  type        = string
  description = "Budget name in the billing console. 60 characters or fewer."

  validation {
    condition     = length(var.display_name) > 0 && length(var.display_name) <= 60
    error_message = "display_name must be 1 to 60 characters."
  }
}

variable "amount_usd" {
  type        = number
  description = "Monthly budget in whole US dollars."

  validation {
    condition     = var.amount_usd > 0
    error_message = "amount_usd must be positive."
  }
}

variable "currency_code" {
  type        = string
  description = "ISO 4217 code. Must match the billing account currency."
  default     = "USD"
}

variable "github_actions_member" {
  type        = string
  description = "IAM member string for the GitHub Actions service account."
}
