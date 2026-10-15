# Root for this environment. Calls the stage-1 modules.
# Separate state from the other environment (backend.tf). No workspace.
# No google_compute_instance.

module "project_services" {
  source = "../../modules/project-services"
  count  = local.manage_project_services ? 1 : 0

  project_id = var.project_id
}

module "network" {
  source = "../../modules/network"

  project_id  = var.project_id
  region      = var.region
  environment = local.environment
  subnet_cidr = local.subnet_cidr

  depends_on = [module.project_services]
}

module "artifact_registry" {
  source = "../../modules/artifact-registry"

  project_id  = var.project_id
  region      = var.region
  environment = local.environment
  labels      = local.labels

  depends_on = [module.project_services]
}

module "secrets" {
  source = "../../modules/secrets"

  project_id  = var.project_id
  environment = local.environment
  labels      = local.labels

  depends_on = [module.project_services]
}

module "iam" {
  source = "../../modules/iam"

  project_id                      = var.project_id
  environment                     = local.environment
  github_repository               = var.github_repository
  restrict_wif_to_main            = local.restrict_wif_to_main
  tfstate_bucket                  = var.tfstate_bucket
  artifact_registry_location      = var.region
  artifact_registry_repository_id = module.artifact_registry.repository_id
  secret_ids                      = module.secrets.ids_by_purpose

  depends_on = [module.project_services]
}

module "database" {
  source = "../../modules/database"

  project_id                    = var.project_id
  region                        = var.region
  environment                   = local.environment
  database_version              = local.database_version
  tier                          = local.sql_tier
  disk_size_gb                  = local.sql_disk_size_gb
  disk_autoresize_limit_gb      = local.sql_disk_autoresize_limit_gb
  deletion_protection           = local.sql_deletion_protection
  backup_enabled                = local.sql_backup_enabled
  point_in_time_recovery        = local.sql_point_in_time_recovery
  backend_service_account_email = module.iam.backend_service_account_email
  labels                        = local.labels

  depends_on = [module.project_services]
}

module "billing" {
  source = "../../modules/billing"

  project_id            = var.project_id
  billing_account_id    = var.billing_account_id
  display_name          = local.budget_display_name
  amount_usd            = local.budget_amount_usd
  github_actions_member = module.iam.github_actions_member

  depends_on = [module.project_services]
}
