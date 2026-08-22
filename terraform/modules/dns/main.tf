# ROUTE53 DNS MODULE

variable "zone_name" {
  type        = string
  description = "The root domain for the Route53 hosted zone (e.g. ysmquizbuzz.com)"
}

variable "fqdn" {
  type        = string
  description = "The domain to create DNS records for (e.g. ysmquizbuzz.com)"
}

variable "is_live" {
  type        = bool
  description = "Whether we are in live mode"
}

variable "admin_eip" {
  type        = string
  description = "The Elastic IP of the admin instance"
}

variable "alb_dns_name" {
  type        = string
  default     = ""
  description = "DNS name of the Application Load Balancer"
}

variable "alb_zone_id" {
  type        = string
  default     = ""
  description = "Hosted zone ID of the Application Load Balancer"
}

variable "aws_region" {
  type        = string
  default     = "ap-south-1"
  description = "AWS region -- needed for ACM (must be same region as ALB)"
}

# -------------------------------------------------------------------------------
# HOSTED ZONE -- look up the existing zone, never create or destroy it.
# The zone was created once (manually or by bootstrap) and lives permanently.
# Using a data source prevents Terraform from ever trying to recreate it,
# which would change the NS records and break DNS for the domain.
# -------------------------------------------------------------------------------
data "aws_route53_zone" "main" {
  name         = var.zone_name
  private_zone = false
}

# -------------------------------------------------------------------------------
# ACM CERTIFICATE -- root domain + wildcard
# Covers: ysmquizbuzz.com, *.ysmquizbuzz.com
# Validated automatically via Route53 DNS (no manual steps ever)
# -------------------------------------------------------------------------------
resource "aws_acm_certificate" "main" {
  domain_name               = var.zone_name
  subject_alternative_names = ["*.${var.zone_name}"]
  validation_method         = "DNS"

  lifecycle {
    # Create new cert before destroying old one.
    # Prevents ALB from briefly having no valid cert during rotation.
    create_before_destroy = true
  }

  tags = {
    Name    = "quizbuzz-acm-cert"
    Project = "QuizBuzz"
  }
}

# ACM writes CNAME records it needs for validation into domain_validation_options.
# This resource reads those and writes them to Route53 automatically.
# No manual copy-paste from the ACM console required.
resource "aws_route53_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id         = data.aws_route53_zone.main.zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 300
  records         = [each.value.record]
  allow_overwrite = true
}

# Blocks terraform apply until ACM has confirmed the certificate is ISSUED.
# Without this, live_contest module would try to attach a PENDING_VALIDATION
# cert to the ALB listener and fail.
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for r in aws_route53_record.acm_validation : r.fqdn]
}

# -------------------------------------------------------------------------------
# A RECORD -- idle/live switching
# -------------------------------------------------------------------------------
#
# FORMER DESIGN (kept here in the history for context — see the incident
# this fixed): this used to be two separate resources, aws_route53_record
# "api_idle" and "api_live", both targeting the exact same zone/name/type
# ("A" record for var.fqdn), gated by complementary `count` values so only
# one existed at a time. That is a well-known Terraform/Route53 footgun:
# switching modes destroys ONE resource address and creates a DIFFERENT
# resource address for the same underlying DNS record. Terraform has no
# inherent ordering between two independent resource addresses in the same
# apply, so depending on graph/provider timing, the create and the delete
# could race — the delete step deletes-by-matching-recorded-values, and if
# the create (an upsert, thanks to allow_overwrite) had already landed
# first, the delete's expected record body no longer matched what was
# actually in Route53, causing an apply-time error or, worse, a apply that
# "succeeds" while actually leaving DNS in a broken transitional state.
# This is the most likely explanation for "containers were healthy but the
# site was unreachable / cert errors right after a mode switch."
#
# FIX: a single resource, same zone/name/type across both modes, with a
# `dynamic "alias"` block that only materializes in live mode. Since it's
# one resource address instead of two, Terraform does an in-place UPDATE
# instead of a destroy/create pair — no race, no window where the record
# is momentarily missing or contested between two resources.
resource "aws_route53_record" "api" {
  zone_id         = data.aws_route53_zone.main.zone_id
  name            = var.fqdn
  type            = "A"
  allow_overwrite = true

  # Idle mode: plain A record -> admin EC2 Elastic IP. 30s TTL for a fast
  # cutover the moment live mode is applied.
  ttl     = var.is_live ? null : 30
  records = var.is_live ? null : [var.admin_eip]

  # Live mode: ALIAS -> ALB. ALIAS is AWS-native (free, health-check aware,
  # works on root domains where CNAME cannot). The dynamic block means this
  # is entirely absent from the resource in idle mode, and `records`/`ttl`
  # are entirely absent in live mode — Terraform (and the AWS API) reject a
  # record that sets both `records` and `alias` at once, so exactly one of
  # the two must be null/omitted at any given time, driven by the same
  # `var.is_live` flag both branches key off.
  dynamic "alias" {
    for_each = var.is_live ? [1] : []
    content {
      name                   = var.alb_dns_name
      zone_id                = var.alb_zone_id
      evaluate_target_health = true
    }
  }
}

# -------------------------------------------------------------------------------
# OUTPUTS
# -------------------------------------------------------------------------------
output "name_servers" {
  value       = data.aws_route53_zone.main.name_servers
  description = "The 4 NS records for the zone -- must match what Hostinger has configured"
}

output "certificate_arn" {
  value       = aws_acm_certificate_validation.main.certificate_arn
  description = "Validated ACM certificate ARN -- used by live_contest ALB listener"
}
