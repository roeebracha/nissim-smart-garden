# Cloud SQL Postgres for the Auth Proxy: public IP, IAM users, no
# authorized networks, no Private IP / VPC peering.
# No password argument on the database user. No secret value here.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

resource "google_sql_database_instance" "postgres" {
  project          = var.project_id
  name             = "nissim-pg-${var.environment}"
  region           = var.region
  database_version = var.database_version

  # Terraform refuses to destroy the instance when this is true.
  # Prod sets it. This is not a Compute Engine VM.
  deletion_protection = var.deletion_protection

  settings {
    # Postgres 16+ defaults to Enterprise Plus, which rejects shared-core
    # tiers. This stage asks for a small tier, so the edition is explicit.
    edition               = "ENTERPRISE"
    tier                  = var.tier
    availability_type     = "ZONAL"
    disk_type             = "PD_SSD"
    disk_size             = var.disk_size_gb
    disk_autoresize       = true
    disk_autoresize_limit = var.disk_autoresize_limit_gb
    activation_policy     = "ALWAYS"

    user_labels = var.labels

    # REQUIRED rejects clients that are not the Auth Proxy or a language
    # connector, including a public IP plus a password from the internet.
    connector_enforcement = "REQUIRED"

    ip_configuration {
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
      # authorized_networks is omitted on purpose. Do not add 0.0.0.0/0.
      # private_network is omitted on purpose. Not Private IP.
    }

    backup_configuration {
      enabled                        = var.backup_enabled
      point_in_time_recovery_enabled = var.point_in_time_recovery
      start_time                     = "03:00"

      backup_retention_settings {
        retained_backups = var.point_in_time_recovery ? 7 : 3
      }

      transaction_log_retention_days = var.point_in_time_recovery ? 7 : null
    }

    maintenance_window {
      day  = 7
      hour = 7
    }

    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on"
    }
  }

  timeouts {
    create = "40m"
    update = "40m"
    delete = "40m"
  }
}

resource "google_sql_database" "nissim" {
  project  = var.project_id
  name     = var.database_name
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "backend" {
  project  = var.project_id
  instance = google_sql_database_instance.postgres.name
  # Postgres IAM usernames drop the .gserviceaccount.com suffix.
  name = trimsuffix(var.backend_service_account_email, ".gserviceaccount.com")
  type = "CLOUD_IAM_SERVICE_ACCOUNT"
  # No password. Provider 5.45 (the ~> 5.0 line bootstrap already locks)
  # has no database_roles argument, so Postgres privileges are not granted
  # here. cloudsqlsuperuser, or a narrower GRANT, is applied out of band
  # after the instance exists. See the PR note.

  depends_on = [google_sql_database.nissim]
}
