variable "project_id" {
  type        = string
  description = "GCP project id. One project holds both environments."
}

variable "services" {
  type        = set(string)
  description = "APIs this stage needs. iamcredentials, sts, and billingbudgets sit next to the short names in docs/infra-terraform.md because WIF and google_billing_budget call them."

  default = [
    "sqladmin.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudbilling.googleapis.com",
    "billingbudgets.googleapis.com",
  ]
}
