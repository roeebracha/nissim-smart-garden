variable "github_owner" {
  type        = string
  description = "GitHub login that owns the repository. Not a token."
  default     = "roeebracha"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+$", var.github_owner))
    error_message = "github_owner must be a GitHub login."
  }
}

variable "repository_name" {
  type        = string
  description = "Repository name without the owner."
  default     = "nissim-smart-garden"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+$", var.repository_name))
    error_message = "repository_name must be a GitHub repository name."
  }
}

variable "prod_reviewer" {
  type        = string
  description = "Login allowed to approve the prod GitHub Environment. This is not a pull-request review."
  default     = "roeebracha"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+$", var.prod_reviewer))
    error_message = "prod_reviewer must be a GitHub login."
  }
}
