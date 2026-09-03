# GCS remote state backend for dev (bucket created by bootstrap/).

terraform {
  backend "gcs" {
    bucket = "nissim-garden-tfstate"
    prefix = "env/dev"
  }
}
