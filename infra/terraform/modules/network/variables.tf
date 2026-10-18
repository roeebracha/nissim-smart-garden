variable "project_id" {
  type        = string
  description = "GCP project id."
}

variable "region" {
  type        = string
  description = "Region for the subnet."
}

variable "environment" {
  type        = string
  description = "dev or prod. Used in resource names."

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be dev or prod."
  }
}

variable "subnet_cidr" {
  type        = string
  description = "CIDR for the single regional subnet. Dev and prod use different ranges."

  validation {
    condition     = can(cidrhost(var.subnet_cidr, 0))
    error_message = "subnet_cidr must be a valid CIDR."
  }
}
