# Project-scoped API enablement for this stage.
# APIs are not per-environment. Only the dev root sets count = 1.
# Prod reuses them. Bootstrap keeps its own two APIs and the state bucket.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

resource "google_project_service" "this" {
  for_each = var.services

  project = var.project_id
  service = each.value

  # A destroy of the dev root must not turn APIs off under prod.
  disable_on_destroy = false
}
