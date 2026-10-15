output "ids_by_purpose" {
  description = "Full secret resource ids keyed by purpose. No secret values."
  value       = { for purpose, secret in google_secret_manager_secret.placeholder : purpose => secret.id }
}

output "secret_ids" {
  description = "Secret id strings (nissim-<env>-<purpose>)."
  value       = { for purpose, secret in google_secret_manager_secret.placeholder : purpose => secret.secret_id }
}
