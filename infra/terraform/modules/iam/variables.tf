variable "project_id" {
  type        = string
  description = "GCP project id."
}

variable "environment" {
  type        = string
  description = "dev or prod. Suffixed onto account ids and the WIF pool id."

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be dev or prod."
  }
}

variable "github_repository" {
  type        = string
  description = "GitHub repository allowed to impersonate the deploy service account (owner/name)."

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "github_repository must look like owner/name."
  }
}

variable "restrict_wif_to_main" {
  type        = bool
  description = "When true, the OIDC condition also requires refs/heads/main. Prod sets this."
}

variable "tfstate_bucket" {
  type        = string
  description = "Bootstrap state bucket name. This module adds IAM members only."
}

variable "artifact_registry_location" {
  type        = string
  description = "Region of the Docker repository."
}

variable "artifact_registry_repository_id" {
  type        = string
  description = "Docker repository id the backend service account may pull from."
}

variable "secret_ids" {
  type        = map(string)
  description = "Secret resource ids keyed by purpose. Must include anthropic-api-key and mqtt-password."

  validation {
    condition     = contains(keys(var.secret_ids), "anthropic-api-key") && contains(keys(var.secret_ids), "mqtt-password")
    error_message = "secret_ids must include anthropic-api-key and mqtt-password."
  }
}
