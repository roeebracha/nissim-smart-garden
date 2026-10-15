output "instance_name" {
  description = "Cloud SQL instance name."
  value       = google_sql_database_instance.postgres.name
}

output "connection_name" {
  description = "Auth Proxy instance connection name (project:region:instance). Not a password."
  value       = google_sql_database_instance.postgres.connection_name
}

output "database_name" {
  description = "Postgres database name."
  value       = google_sql_database.nissim.name
}

output "iam_database_user" {
  description = "IAM database username (service account email without .gserviceaccount.com)."
  value       = google_sql_user.backend.name
}
