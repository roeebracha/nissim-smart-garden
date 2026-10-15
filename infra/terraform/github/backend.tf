# Remote state for GitHub settings. Prefix is not env/dev or env/prod.
# CI validates with -backend=false and does not apply this root.
# deploy.yml does not apply it either: that workflow has no GitHub token,
# and a token does not belong in the repo.

terraform {
  backend "gcs" {
    bucket = "nissim-garden-tfstate"
    prefix = "github"
  }
}
