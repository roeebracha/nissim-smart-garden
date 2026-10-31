terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region

  # Billing budget calls need a quota project when the credentials are
  # user ADC or WIF. See hashicorp/google google_billing_budget.
  billing_project       = var.project_id
  user_project_override = true
}
