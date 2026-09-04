# GCS remote state backend for prod (bucket created by bootstrap/).

terraform {
  backend "gcs" {
    bucket = "nissim-garden-tfstate"
    prefix = "env/prod"
  }
}
