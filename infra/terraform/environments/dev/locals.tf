# Identity of this root. Not a tfvar, so an apply here cannot be pointed
# at prod names. State prefix lives in backend.tf (env/dev), not here.
locals {
  environment = "dev"

  # Separate from prod's 10.20.0.0/24. The VPCs are not peered.
  subnet_cidr = "10.10.0.0/24"

  # APIs are project-global. Dev enables them; prod does not create a
  # second copy in its state. Apply dev before prod.
  manage_project_services = true

  # Shared-core, outside the Cloud SQL SLA. Small tier from infra-terraform.md.
  # Postgres 18 matches the Compose image.
  database_version             = "POSTGRES_18"
  sql_tier                     = "db-f1-micro"
  sql_disk_size_gb             = 10
  sql_disk_autoresize_limit_gb = 20
  sql_deletion_protection      = false
  sql_backup_enabled           = true
  sql_point_in_time_recovery   = false

  # Rough monthly floor once dev and prod SQL both exist is about $40
  # before the deferred VMs. This budget watches the whole project.
  budget_display_name = "nissim-early-warning"
  budget_amount_usd   = 50

  # deploy.yml ships any branch to dev, so the OIDC condition is the
  # repository only.
  restrict_wif_to_main = false

  labels = {
    app         = "nissim"
    environment = local.environment
    managed_by  = "terraform"
  }
}
