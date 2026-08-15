# One-time bootstrap, local state: GCS bucket for remote state + base API enablement.
# See docs/infra-terraform.md.

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "nissim-garden"
  region  = "us-central1"
}

# Only what bootstrap's own resources below need on a brand-new project.
# sqladmin/artifactregistry/secretmanager etc. (docs/infra-terraform.md) belong
# to the environments stage, enabled where they're actually used - not here.
resource "google_project_service" "cloudresourcemanager" {
  service            = "cloudresourcemanager.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "storage" {
  service            = "storage.googleapis.com"
  disable_on_destroy = false
}

resource "google_storage_bucket" "state" {
  name                        = "nissim-garden-tfstate"
  location                    = "US"
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  # No implicit reference to google_project_service.storage above (nothing in
  # this block reads from it) - without this, Terraform has no way to know the
  # bucket must wait for the Storage API to be enabled first.
  depends_on = [google_project_service.storage]
}
