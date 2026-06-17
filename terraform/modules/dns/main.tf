# ROUTE53 DNS MODULE

variable "zone_name" {
  type        = string
  description = "The name of the Route53 hosted zone to create (e.g. quiz.ysminfosolution.com)"
}

variable "fqdn" {
  type        = string
  description = "Fully Qualified Domain Name (e.g. quiz.ysminfosolution.com)"
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

# The Hosted Zone is permanent
resource "aws_route53_zone" "main" {
  name = var.zone_name
  tags = {
    Name        = "quizbuzz-dns-zone"
    Project     = "QuizBuzz"
    Environment = "prod"
  }
}

# IDLE MODE: A record pointing to t3.small Elastic IP
resource "aws_route53_record" "api_idle" {
  count   = var.is_live ? 0 : 1
  zone_id = aws_route53_zone.main.zone_id
  name    = var.fqdn
  type    = "A"
  ttl     = 30   # 30s TTL — fast switching when going live
  records = [var.admin_eip]
}

# LIVE MODE: ALIAS record pointing to ALB
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

output "name_servers" {
  value       = aws_route53_zone.main.name_servers
  description = "The nameservers to configure in host.co.in for delegation"
}
