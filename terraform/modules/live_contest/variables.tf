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
  default     = "c6i.large"
  description = "EC2 instance type for quiz backend fleet. c6i.large = 2vCPU, 4GB — compute-optimized for WebSocket + Socket.IO throughput."
}

variable "min_size" {
  type        = number
  default     = 2
  description = "ASG minimum instances. Never below 2 — single instance = single point of failure during a live quiz."
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
