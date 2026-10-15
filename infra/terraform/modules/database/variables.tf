variable "project_id" {
  type        = string
  description = "GCP project id."
}

variable "region" {
  type        = string
  description = "Cloud SQL region."
}

variable "environment" {
  type        = string
  description = "dev or prod. Used in the instance name."

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be dev or prod."
  }
}

variable "database_version" {
  type        = string
  description = "Cloud SQL Postgres major version. POSTGRES_18 matches docker-compose."
}

variable "tier" {
  type        = string
  description = "Shared-core machine tier. These tiers are outside the Cloud SQL SLA."
}

variable "disk_size_gb" {
  type        = number
  description = "Initial SSD size in GB."

  validation {
    condition     = var.disk_size_gb >= 10
    error_message = "Cloud SQL SSD disks start at 10 GB."
  }
}

variable "disk_autoresize_limit_gb" {
  type        = number
  description = "Cap for disk autoresize, in GB."

  validation {
    condition     = var.disk_autoresize_limit_gb >= var.disk_size_gb
    error_message = "disk_autoresize_limit_gb must be at least disk_size_gb."
  }
}

variable "deletion_protection" {
  type        = bool
  description = "When true, Terraform and the API refuse to destroy the instance."
}

variable "backup_enabled" {
  type        = bool
  description = "Daily backups."
}

variable "point_in_time_recovery" {
  type        = bool
  description = "WAL-based point-in-time recovery. Requires backups."

  validation {
    condition     = var.backup_enabled || !var.point_in_time_recovery
    error_message = "point_in_time_recovery requires backup_enabled."
  }
}

variable "database_name" {
  type        = string
  description = "Postgres database name inside the instance."
  default     = "nissim"
}

variable "backend_service_account_email" {
  type        = string
  description = "Backend VM service account. Becomes the IAM database user. No password."
}

variable "labels" {
  type        = map(string)
  description = "user_labels on the instance."
}
