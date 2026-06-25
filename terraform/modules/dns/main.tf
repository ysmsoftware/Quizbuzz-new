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
  description = "AWS region — needed for ACM (must be same region as ALB)"
}

# ───────────────────────────────────────────────────────────────────────────────
# HOSTED ZONE — permanent, never destroyed
# ───────────────────────────────────────────────────────────────────────────────
resource "aws_route53_zone" "main" {
  name = var.zone_name
  tags = {
    Name        = "quizbuzz-dns-zone"
    Project     = "QuizBuzz"
    Environment = "prod"
  }
}

# ───────────────────────────────────────────────────────────────────────────────
# ACM CERTIFICATE — root domain + wildcard
# Covers: ysmquizbuzz.com, *.ysmquizbuzz.com
# Validated automatically via Route53 DNS (no manual steps ever)
# ───────────────────────────────────────────────────────────────────────────────
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

  zone_id = aws_route53_zone.main.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 300
  records = [each.value.record]
}

# Blocks terraform apply until ACM has confirmed the certificate is ISSUED.
# Without this, live_contest module would try to attach a PENDING_VALIDATION
# cert to the ALB listener and fail.
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for r in aws_route53_record.acm_validation : r.fqdn]
}

# ───────────────────────────────────────────────────────────────────────────────
# A RECORDS — idle/live switching
# ───────────────────────────────────────────────────────────────────────────────
# IDLE MODE: A record → admin EC2 Elastic IP
resource "aws_route53_record" "api_idle" {
  count   = var.is_live ? 0 : 1
  zone_id = aws_route53_zone.main.zone_id
  name    = var.fqdn
  type    = "A"
  ttl     = 30   # 30s TTL — fast cutover when going live
  records = [var.admin_eip]
}

# LIVE MODE: ALIAS record → ALB
# ALIAS is AWS-native (free, health-check aware, works on root domain).
# CNAME cannot be used on root domains — ALIAS is the correct solution.
resource "aws_route53_record" "api_live" {
  count   = var.is_live ? 1 : 0
  zone_id = aws_route53_zone.main.zone_id
  name    = var.fqdn
  type    = "A"
  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}

# ───────────────────────────────────────────────────────────────────────────────
# OUTPUTS
# ───────────────────────────────────────────────────────────────────────────────
output "name_servers" {
  value       = aws_route53_zone.main.name_servers
  description = "Paste these 4 into Hostinger ’Change Nameservers’ for ysmquizbuzz.com"
}

output "certificate_arn" {
  value       = aws_acm_certificate_validation.main.certificate_arn
  description = "Validated ACM certificate ARN — used by live_contest ALB listener"
}
