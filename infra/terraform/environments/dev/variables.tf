variable "project_id" {
  type        = string
  description = "Single GCP project for dev and prod (docs/infra-terraform.md)."
  default     = "nissim-garden"
}

variable "region" {
  type        = string
  description = "Region for regional resources. Matches bootstrap and deploy.yml."
  default     = "us-central1"
}

variable "billing_account_id" {
  type        = string
  description = "Billing account id (XXXXXX-XXXXXX-XXXXXX). Set TF_VAR_billing_account_id at apply time. Not a secret. Do not commit terraform.tfvars."

  validation {
    condition     = can(regex("^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$", var.billing_account_id))
    error_message = "billing_account_id must look like 012345-6789AB-CDEF01."
  }
}

variable "github_repository" {
  type        = string
  description = "GitHub repository allowed to assume the deploy service account via WIF."
  default     = "roeebracha/nissim-smart-garden"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "github_repository must look like owner/name."
  }
}

variable "tfstate_bucket" {
  type        = string
  description = "Existing GCS bucket from bootstrap/. This root only adds IAM members; it does not manage the bucket."
  default     = "nissim-garden-tfstate"
}
