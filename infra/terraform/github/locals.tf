# These strings are the job `name:` values in .github/workflows/ci.yml.
# Confirmed on this repo: the check is "Lint", not "CI / Lint".
# "Terraform plan" is a job in that file and is not in this list.
# It skips until WIF variables exist. A skipped required check is the
# wrong gate for that period. docs/git-workflow.md.
locals {
  required_status_checks = [
    "Lint",
    "Typecheck",
    "Tests",
    "Docker",
    "Commitlint",
    "Terraform",
  ]
}
