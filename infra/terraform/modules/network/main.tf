# Custom VPC. auto_create_subnetworks = false is what keeps this off the
# default network (the default network is the one GCP pre-creates with
# open SSH/RDP rules). No google_compute_instance: VMs are a later stage.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

resource "google_compute_network" "vpc" {
  project                 = var.project_id
  name                    = "nissim-vpc-${var.environment}"
  description             = "Custom VPC for nissim ${var.environment}."
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"

  # Keep the default internet route. The Cloud SQL decision is public IP
  # plus the Auth Proxy, so a future VM needs egress to that IP. Private
  # Google Access does not replace that path.
  delete_default_routes_on_create = false
}

resource "google_compute_subnetwork" "main" {
  project                  = var.project_id
  name                     = "nissim-subnet-${var.environment}"
  description              = "Regional subnet for the future broker and backend VMs."
  region                   = var.region
  network                  = google_compute_network.vpc.id
  ip_cidr_range            = var.subnet_cidr
  private_ip_google_access = true
}

# A custom VPC does not get the default network's allow-internal rule.
# Without this, future VMs in the subnet cannot talk to each other.
resource "google_compute_firewall" "internal" {
  project     = var.project_id
  name        = "nissim-allow-internal-${var.environment}"
  description = "TCP, UDP, and ICMP from the subnet to itself."
  network     = google_compute_network.vpc.id
  direction   = "INGRESS"
  priority    = 1000

  source_ranges = [var.subnet_cidr]

  allow {
    protocol = "tcp"
  }

  allow {
    protocol = "udp"
  }

  allow {
    protocol = "icmp"
  }
}

# IAP's published range. Port 22 is not open to 0.0.0.0/0. Future VMs opt
# in with the nissim-ssh tag. MQTT 1883 and the backend port stay closed.
resource "google_compute_firewall" "iap_ssh" {
  project     = var.project_id
  name        = "nissim-allow-iap-ssh-${var.environment}"
  description = "SSH from Identity-Aware Proxy only."
  network     = google_compute_network.vpc.id
  direction   = "INGRESS"
  priority    = 1000

  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["nissim-ssh"]

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}
