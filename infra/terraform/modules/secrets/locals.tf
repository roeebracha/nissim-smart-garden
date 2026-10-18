locals {
  # Names only. mqtt-password is for the future broker. anthropic-api-key
  # is the LLM credential from decision 2. Neither has a version here.
  purposes = toset([
    "mqtt-password",
    "anthropic-api-key",
  ])
}
