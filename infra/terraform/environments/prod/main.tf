# Root config for prod — calls modules/{network,database,artifact-registry,iam}.
# Modules are still comment skeletons; this file is valid HCL so CI can
# `terraform validate` (docs/git-workflow.md).

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
  project = "nissim-garden"
  region  = "us-central1"
}
