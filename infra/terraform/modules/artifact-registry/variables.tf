variable "project_id" {
  type        = string
  description = "GCP project id."
}

variable "region" {
  type        = string
  description = "Artifact Registry location."
}

variable "environment" {
  type        = string
  description = "dev or prod. Suffixed onto the repository id."

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be dev or prod."
  }
}

variable "labels" {
  type        = map(string)
  description = "Repository labels."
}
