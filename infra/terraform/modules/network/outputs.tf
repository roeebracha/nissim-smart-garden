output "network_name" {
  description = "Custom VPC name."
  value       = google_compute_network.vpc.name
}

output "network_id" {
  description = "Custom VPC id."
  value       = google_compute_network.vpc.id
}

output "subnet_name" {
  description = "Regional subnet name."
  value       = google_compute_subnetwork.main.name
}

output "subnet_cidr" {
  description = "Regional subnet CIDR."
  value       = google_compute_subnetwork.main.ip_cidr_range
}
