# GitHub repository settings. One root, one state prefix (`github/`).
# dev and prod GCP roots must not both own branch protection or the
# environments. This root does not talk to GCP APIs. The GCS backend
# still needs Google credentials at apply time, same bucket as the
# environment roots.
# No GitHub token in this directory. The provider reads GITHUB_TOKEN
# from the process environment when someone applies locally.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }
}

provider "github" {
  owner = var.github_owner
}
