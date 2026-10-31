# One budget resource per environment root. Both filter to the whole
# project, because dev and prod share a project and a label filter would
# miss spend that has no environment label. The dev root owns the lower
# early-warning amount. The prod root owns the higher ceiling.
# Amounts are numbers in locals, not secret values.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

data "google_project" "this" {
  project_id = var.project_id
}

resource "google_billing_budget" "environment" {
  billing_account = var.billing_account_id
  display_name    = var.display_name

  budget_filter {
    projects        = ["projects/${data.google_project.this.number}"]
    calendar_period = "MONTH"
  }

  amount {
    specified_amount {
      currency_code = var.currency_code
      units         = tostring(var.amount_usd)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }

  threshold_rules {
    threshold_percent = 0.9
  }

  threshold_rules {
    threshold_percent = 1.0
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "FORECASTED_SPEND"
  }
}

# Later applies run as the GitHub Actions service account. Creating this
# binding needs Billing Account Administrator on the first apply.
resource "google_billing_account_iam_member" "github_actions" {
  billing_account_id = var.billing_account_id
  role               = "roles/billing.costsManager"
  member             = var.github_actions_member
}
