output "broker_service_account_email" {
  description = "Broker service account email. No VM is attached."
  value       = google_service_account.broker.email
}

output "backend_service_account_email" {
  description = "Backend service account email. This is also the Cloud SQL IAM user."
  value       = google_service_account.backend.email
}

output "github_actions_service_account_email" {
  description = "Value for the GitHub Environment variable WIF_SERVICE_ACCOUNT, after apply."
  value       = google_service_account.github_actions.email
}

output "github_actions_member" {
  description = "IAM member string for the GitHub Actions service account."
  value       = "serviceAccount:${google_service_account.github_actions.email}"
}

output "workload_identity_provider" {
  description = "Value for the GitHub Environment variable WIF_PROVIDER, after apply."
  value       = google_iam_workload_identity_pool_provider.github.name
}
