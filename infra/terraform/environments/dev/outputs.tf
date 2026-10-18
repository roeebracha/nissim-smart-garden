output "workload_identity_provider" {
  description = "GitHub Environment variable WIF_PROVIDER. Populated after apply."
  value       = module.iam.workload_identity_provider
}

output "github_actions_service_account" {
  description = "GitHub Environment variable WIF_SERVICE_ACCOUNT. Populated after apply."
  value       = module.iam.github_actions_service_account_email
}

output "backend_service_account_email" {
  description = "Future backend VM service account."
  value       = module.iam.backend_service_account_email
}

output "broker_service_account_email" {
  description = "Future broker VM service account."
  value       = module.iam.broker_service_account_email
}

output "sql_connection_name" {
  description = "Cloud SQL Auth Proxy connection name. Not a password."
  value       = module.database.connection_name
}

output "sql_iam_database_user" {
  description = "IAM database username for the backend service account."
  value       = module.database.iam_database_user
}

output "artifact_repository_id" {
  description = "Docker repository id. deploy.yml still uses nissim until the plan/deploy PR."
  value       = module.artifact_registry.repository_id
}

output "artifact_image_prefix" {
  description = "Registry host plus repository. Append /backend and a tag."
  value       = module.artifact_registry.image_prefix
}

output "network_name" {
  description = "Custom VPC name."
  value       = module.network.network_name
}

output "secret_ids" {
  description = "Placeholder secret ids. No versions, no values."
  value       = module.secrets.secret_ids
}
