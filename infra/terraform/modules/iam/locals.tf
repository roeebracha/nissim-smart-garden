locals {
  repository_clause   = "assertion.repository == \"${var.github_repository}\""
  ref_clause          = var.restrict_wif_to_main ? " && assertion.ref == \"refs/heads/main\"" : ""
  attribute_condition = "${local.repository_clause}${local.ref_clause}"

  # Auth Proxy (cloudsql.client) plus IAM database login (cloudsql.instanceUser).
  # Logs and metrics for the future VM. No instanceAdmin.
  backend_roles = toset([
    "roles/cloudsql.client",
    "roles/cloudsql.instanceUser",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ])

  # The broker does not connect to Cloud SQL and does not pull images.
  broker_roles = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ])

  # Roles the apply identity needs for the resources in this stage.
  # Omitted on purpose:
  # - roles/owner and roles/editor
  # - roles/compute.instanceAdmin.v1 (no VMs)
  # - roles/iam.serviceAccountKeyAdmin (no JSON keys)
  # - project-wide roles/iam.serviceAccountUser (bound on the two VM accounts only)
  github_actions_roles = toset([
    "roles/compute.networkAdmin",
    "roles/cloudsql.admin",
    "roles/artifactregistry.admin",
    "roles/secretmanager.admin",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.workloadIdentityPoolAdmin",
    "roles/serviceusage.serviceUsageAdmin",
    "roles/resourcemanager.projectIamAdmin",
  ])
}
