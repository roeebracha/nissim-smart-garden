output "required_status_checks" {
  description = "Status checks required on main. Does not include Terraform plan."
  value       = local.required_status_checks
}

output "dev_environment" {
  description = "GitHub Environment for dev deploys and for the pull-request plan job."
  value       = github_repository_environment.dev.environment
}

output "prod_environment" {
  description = "GitHub Environment for prod deploys. Required reviewer, main only."
  value       = github_repository_environment.prod.environment
}

output "prod_reviewer" {
  description = "Login configured as the prod environment reviewer."
  value       = data.github_user.prod_reviewer.login
}
