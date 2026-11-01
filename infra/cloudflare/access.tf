locals {
  owner_policy = [{
    name       = "Allow owner only"
    decision   = "allow"
    precedence = 1
    include = [{
      email = { email = var.owner_email }
    }]
  }]
}

resource "cloudflare_zero_trust_access_application" "staging" {
  account_id = var.account_id
  name       = "Turbobard Admin Staging"
  domain     = var.staging_hostname
  type       = "self_hosted"
  policies   = local.owner_policy
}

resource "cloudflare_zero_trust_access_application" "production" {
  account_id = var.account_id
  name       = "Turbobard Admin Production"
  domain     = var.production_hostname
  type       = "self_hosted"
  policies   = local.owner_policy
}

resource "cloudflare_workers_custom_domain" "staging" {
  account_id       = var.account_id
  zone_id          = var.zone_id
  hostname         = var.staging_hostname
  service          = "turbobard-admin-staging"
  enabled          = true
  previews_enabled = false
}

resource "cloudflare_workers_custom_domain" "production" {
  account_id       = var.account_id
  zone_id          = var.zone_id
  hostname         = var.production_hostname
  service          = "turbobard-admin-production"
  enabled          = true
  previews_enabled = false
}
