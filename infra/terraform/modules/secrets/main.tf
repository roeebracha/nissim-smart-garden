# Secret Manager containers only. There is no
# google_secret_manager_secret_version in this module: a version would
# put a value in Terraform state. Values are added out of band, after apply.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

resource "google_secret_manager_secret" "placeholder" {
  for_each = local.purposes

  project   = var.project_id
  secret_id = "nissim-${var.environment}-${each.key}"
  labels    = var.labels

  replication {
    auto {}
  }
}
