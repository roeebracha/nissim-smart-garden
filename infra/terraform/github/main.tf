# Repository settings for the deploy policy in docs/git-workflow.md.
# No google_compute_instance. No token attribute. No pull-request
# approval rule: this is a solo repo, and GitHub does not count the
# author's own review toward "required approvals".

data "github_user" "prod_reviewer" {
  username = var.prod_reviewer
}

# dev already exists (the deploy workflow references environment: dev).
# The import adopts it on the first apply instead of failing with
# "environment already exists". Later applies no-op the import once
# the resource is in state. prod is created here; it did not exist yet.
import {
  to = github_repository_environment.dev
  id = "${var.repository_name}:dev"
}

resource "github_repository_environment" "dev" {
  environment = "dev"
  repository  = var.repository_name

  # No reviewers block: any branch may deploy to the one shared dev.
  # No deployment_branch_policy: that would limit which branches can
  # deploy, and dev is the opposite rule.
  can_admins_bypass = true
}

resource "github_repository_environment" "prod" {
  environment = "prod"
  repository  = var.repository_name

  # The operator is the reviewer. prevent_self_review would mean a
  # solo deploy can never be approved. can_admins_bypass stays false
  # so the approval click is the gate, not an admin skip.
  prevent_self_review = false
  can_admins_bypass   = false
  wait_timer          = 0

  reviewers {
    users = [data.github_user.prod_reviewer.id]
  }

  # Only a protected branch may deploy here. The resource below
  # protects main and no other branch. deploy.yml also refuses a
  # ref other than refs/heads/main.
  deployment_branch_policy {
    protected_branches     = true
    custom_branch_policies = false
  }

  depends_on = [github_branch_protection.main]
}

resource "github_branch_protection" "main" {
  repository_id = var.repository_name
  pattern       = "main"

  # A wrong check name with enforce_admins true locks the only admin
  # out of main. Leave this false so an admin can still merge, fix
  # the name, and apply again. The normal path is still the checks.
  enforce_admins = false

  allows_deletions    = false
  allows_force_pushes = false

  # History on main includes merge commits. Linear history would
  # reject that button.
  required_linear_history = false

  required_status_checks {
    # The branch must contain the latest main before merge.
    strict   = true
    contexts = local.required_status_checks
  }

  # No required_pull_request_reviews block. Adding the block turns on
  # human approval. Do not set required_approving_review_count either.
}
