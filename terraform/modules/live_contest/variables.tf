# LIVE CONTEST MODULE — VARIABLES
#
# This module is only ever instantiated when mode = "live" (root main.tf
# wraps it with count = local.is_live ? 1 : 0). Every variable here is
# passed in explicitly from the root module — this module has zero
# hardcoded references to other modules so it stays independently testable.

# ── NETWORKING (from networking module) ────────────────────────────────────
variable "vpc_id" {
  type        = string
  description = "VPC ID — target groups and security groups must live in this VPC"
}

variable "public_subnets" {
  type        = list(string)
  description = "Public subnet IDs — the ALB itself lives here (public-facing)"
}

variable "private_subnets" {
  type        = list(string)
  description = "Database-tier private subnet IDs (RDS only) — passed through for reference, not used for routing by this module"
}

variable "quiz_private_subnets" {
  type        = list(string)
  description = "Quiz-compute-tier private subnet IDs — quiz EC2s and ElastiCache live here. This module attaches a NAT Gateway route to these specific subnets, separate from RDS's subnets."
}

variable "quiz_route_table_id" {
  type        = string
  description = "Quiz private route table ID — used by this module to inject/remove the NAT route"
}

variable "alb_sg_id" {
  type        = string
  description = "Security group allowing 80/443 inbound from the internet to the ALB"
}

variable "ec2_sg_id" {
  type        = string
  description = "Security group for quiz EC2 instances (reused from the admin EC2's SG — already allows 3005)"
}

variable "elasticache_sg_id" {
  type        = string
  description = "Security group allowing port 6379 inbound only from ec2_sg_id"
}

# ── COMPUTE SIZING ───────────────────────────────────────────────────────────
variable "instance_type" {
  type        = string
  default     = "t3.medium"
  description = "EC2 instance type for quiz backend fleet. t3.medium = 2vCPU, 4GB — compute-optimized for WebSocket + Socket.IO throughput."
}

variable "min_size" {
  type        = number
  default     = 2
  description = "ASG minimum instances. Was temporarily raised to 3 during the mass-disconnect investigation, on the theory that each t3.medium hits its EC2 network packets-per-second allowance at ~450-500 concurrent WebSocket connections. That theory is now retired — the actual cause was a k6 test-script bug (blocking sleep() in a WebSocket message handler, causing false ping-timeout disconnects unrelated to instance capacity) — see load-testing/LOAD_TEST_INCIDENT_REPORT.md §1j/§1n. Floor kept at 2, not dropped to 1, for an independent reason: single instance = single point of failure during a live quiz (a deploy, an AZ blip, or an instance replacement would drop every connected participant with no failover). Real scale-out beyond this floor is now driven by connections_scale_out (asg.tf), which tracks actual WebSocket load instead of CPU."
}

variable "max_size" {
  type        = number
  default     = 10
  description = "ASG maximum instances. Hard cap regardless of expected_participants, to bound worst-case cost."
}

variable "desired_capacity" {
  type        = number
  description = "Initial instance count, calculated by root module from expected_participants (1 instance per ~1000 users)."
}

variable "target_connections_per_instance" {
  type        = number
  default     = 500
  description = "Target active WebSocket connections per instance for the connections_scale_out target-tracking policy (asg.tf) — the real scale-out signal, since this I/O-bound workload never drives CPU past ~25% even near saturation. Starting value only, NOT yet empirically re-validated post the load-testing/LOAD_TEST_INCIDENT_REPORT.md §1j fix — tune after §1n's 600/750-participant scale-out validation runs."
}

# ── APPLICATION CONFIG ──────────────────────────────────────────────────────
variable "aws_region" {
  type        = string
  description = "AWS region — used for SSM parameter lookups and CloudWatch log groups on quiz EC2s"
}

variable "s3_bucket" {
  type        = string
  description = "S3 bucket name for certificate/asset storage — passed into quiz EC2 .env"
}

variable "github_org" {
  type        = string
  description = "GitHub org/user for GHCR image pulls (ghcr.io/<github_org>/quizbuzz-backend)"
}

variable "domain" {
  type        = string
  default     = "quiz.ysminfosolution.com"
  description = "Public domain — written into quiz EC2 .env for CORS_ALLOWED_ORIGINS, COOKIE_DOMAIN, etc."
}

# ── CROSS-MODULE REFERENCE ──────────────────────────────────────────────────
variable "admin_instance_id" {
  type        = string
  description = "EC2 instance ID of the existing admin instance — registered into the ALB's admin-tg so admin traffic also flows through the ALB during live mode"
}

variable "acm_certificate_arn" {
  type        = string
  description = "ARN of the ACM certificate for SSL/TLS on the ALB listener"

  validation {
    condition     = length(var.acm_certificate_arn) > 0
    error_message = "acm_certificate_arn is required in live mode. Set it in terraform.tfvars or pass -var=\"acm_certificate_arn=arn:aws:acm:...\". See variables.tf for instructions."
  }
}
