# Identity of this root. Not a tfvar, so an apply here cannot be pointed
# at dev names. State prefix lives in backend.tf (env/prod), not here.
locals {
  environment = "prod"

  # Separate from dev's 10.10.0.0/24. The VPCs are not peered.
  subnet_cidr = "10.20.0.0/24"

  # Dev owns google_project_service. Applying prod first fails until
  # those APIs exist. deploy.yml already applies dev before prod.
  manage_project_services = false

  # Still shared-core (outside the Cloud SQL SLA), one step above dev's
  # db-f1-micro. Postgres 18 matches the Compose image.
  database_version             = "POSTGRES_18"
  sql_tier                     = "db-g1-small"
  sql_disk_size_gb             = 10
  sql_disk_autoresize_limit_gb = 20
  sql_deletion_protection      = true
  sql_backup_enabled           = true
  sql_point_in_time_recovery   = true

  # Higher ceiling on the same project spend the dev budget already watches.
  budget_display_name = "nissim-ceiling"
  budget_amount_usd   = 100

  # deploy.yml refuses prod from a branch other than main. The OIDC
  # condition matches that. A pull_request plan cannot use this
  # provider: the OIDC ref is refs/pull/N/merge, not refs/heads/main.
  # The plan job authenticates with the dev pool and only runs plan.
  restrict_wif_to_main = true

  labels = {
    app         = "nissim"
    environment = local.environment
    managed_by  = "terraform"
  }
}
