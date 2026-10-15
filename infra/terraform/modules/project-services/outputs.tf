output "services" {
  description = "API service names this module enables."
  value       = sort([for service in google_project_service.this : service.service])
}
