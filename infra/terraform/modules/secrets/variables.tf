variable "project_id" {
  type        = string
  description = "GCP project id."
}

variable "environment" {
  type        = string
  description = "dev or prod. Prefixed onto each secret id."

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be dev or prod."
  }
}

variable "labels" {
  type        = map(string)
  description = "Labels on each secret container."
}
