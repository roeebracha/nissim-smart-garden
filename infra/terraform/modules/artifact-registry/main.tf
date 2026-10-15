# Docker repository for the backend image. Per environment, because dev
# and prod are separate Terraform states in one GCP project and cannot
# both own a single repository id.
# deploy.yml still says ARTIFACT_REPO=nissim. The plan/deploy PR updates
# that path. This module does not edit the workflow.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

resource "google_artifact_registry_repository" "docker" {
  project       = var.project_id
  location      = var.region
  repository_id = "nissim-${var.environment}"
  description   = "Docker images for nissim ${var.environment}."
  format        = "DOCKER"
  labels        = var.labels

  # deploy.yml moves the :dev and :prod tags. Immutable tags would reject that.
  docker_config {
    immutable_tags = false
  }
}
