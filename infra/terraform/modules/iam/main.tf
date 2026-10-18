# Identities for this stage. No google_compute_instance and no
# google_service_account_key. The broker and backend service accounts
# exist so a later VM can attach them. Workload Identity Federation
# replaces a JSON key for GitHub Actions.
# The Cloud Run comment that used to live here was stale.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

resource "google_service_account" "broker" {
  project      = var.project_id
  account_id   = "nissim-broker-${var.environment}"
  display_name = "Nissim broker (${var.environment})"
  description  = "Future Mosquitto VM. No instance is created in this stage."
}

resource "google_service_account" "backend" {
  project      = var.project_id
  account_id   = "nissim-backend-${var.environment}"
  display_name = "Nissim backend (${var.environment})"
  description  = "Future backend VM. No instance is created in this stage."
}

resource "google_service_account" "github_actions" {
  project      = var.project_id
  account_id   = "github-actions-${var.environment}"
  display_name = "GitHub Actions (${var.environment})"
  description  = "Deploy identity via Workload Identity Federation. No JSON key."
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "nissim-github-${var.environment}"
  display_name              = "GitHub Actions (${var.environment})"
  description               = "OIDC pool for ${var.github_repository}. One pool per environment root so two states do not own one pool."
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub"
  attribute_condition                = local.attribute_condition

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_wif" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}

# Non-authoritative members. google_project_iam_binding would remove
# every other principal that holds the same role.
resource "google_project_iam_member" "backend" {
  for_each = local.backend_roles

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_project_iam_member" "broker" {
  for_each = local.broker_roles

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.broker.email}"
}

resource "google_project_iam_member" "github_actions" {
  for_each = local.github_actions_roles

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_artifact_registry_repository_iam_member" "backend_reader" {
  project    = var.project_id
  location   = var.artifact_registry_location
  repository = var.artifact_registry_repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_secret_manager_secret_iam_member" "backend_anthropic" {
  project   = var.project_id
  secret_id = var.secret_ids["anthropic-api-key"]
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_secret_manager_secret_iam_member" "broker_mqtt" {
  project   = var.project_id
  secret_id = var.secret_ids["mqtt-password"]
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.broker.email}"
}

# Attaching a service account to a future VM needs serviceAccountUser on
# that account, not on every account in the project.
resource "google_service_account_iam_member" "github_use_backend" {
  service_account_id = google_service_account.backend.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_service_account_iam_member" "github_use_broker" {
  service_account_id = google_service_account.broker.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_actions.email}"
}

# IAM on the bootstrap bucket. This does not manage the bucket resource
# and does not change bootstrap/. Members are not limited to the state
# prefix: a prefix condition breaks Terraform's bucket get/list. Both
# environment service accounts can read both prefixes. The state prefix
# in backend.tf is the isolation this stage has without editing bootstrap.
resource "google_storage_bucket_iam_member" "tfstate_objects" {
  bucket = var.tfstate_bucket
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_storage_bucket_iam_member" "tfstate_bucket_reader" {
  bucket = var.tfstate_bucket
  role   = "roles/storage.legacyBucketReader"
  member = "serviceAccount:${google_service_account.github_actions.email}"
}
