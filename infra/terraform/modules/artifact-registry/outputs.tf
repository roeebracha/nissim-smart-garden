output "repository_id" {
  description = "Repository id (nissim-dev or nissim-prod), not the host path."
  value       = google_artifact_registry_repository.docker.repository_id
}

output "image_prefix" {
  description = "Host path up to the repository. Image name is appended by deploy."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
}
