##############################################################################
# NETWORKING MODULE
# Creates the VPC, subnets, internet gateway, route tables, and all
# security groups that every other module depends on.
#
# CHANGE FROM PREVIOUS VERSION:
#   - EC2 security group now opens port 3005 (backend) instead of 3000
#   - EC2 security group opens port 3000 (frontend) instead of 3001
#   - These now match your actual docker-compose.prod.yml port mappings
##############################################################################

variable "your_ip" {
  description = "Your IP for SSH access. Format: 1.2.3.4/32. Use 0.0.0.0/0 to allow from anywhere."
  default     = "0.0.0.0/0"
}

# Discovers which AZs exist in ap-south-1 (ap-south-1a, ap-south-1b, etc.)
# Using a data source instead of hardcoding means this works in any region.
data "aws_availability_zones" "available" {
  state = "available"
}

# ─────────────────────────────────────────────────────────────────────────────
# VPC — your private network in AWS
# All resources (EC2, RDS, ElastiCache) live inside this VPC.
# enable_dns_hostnames + enable_dns_support: required for RDS endpoints
# to resolve correctly from within the VPC.
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = { Name = "quizbuzz-vpc" }
}

# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC SUBNETS (2 AZs)
# For resources reachable from the internet: admin EC2, ALB (live mode).
# map_public_ip_on_launch = true: EC2s here get a public IP automatically.
# For the admin EC2 we override this with an Elastic IP (more stable).
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags                    = { Name = "quizbuzz-public-${count.index}" }
}

# ─────────────────────────────────────────────────────────────────────────────
# PRIVATE SUBNETS (2 AZs) — DATABASE / ISOLATED TIER
# For resources that must NEVER be directly reachable from the internet AND
# must never have outbound internet access either: RDS PostgreSQL.
# RDS subnet groups require at least 2 AZs even for single-AZ deployments.
#
# ISOLATION GUARANTEE: these subnets are associated ONLY with
# aws_route_table.private below, which has NO internet route — not now,
# not during live mode, not ever. The live_contest module's NAT Gateway
# route is deliberately added to a SEPARATE set of subnets (quiz_private,
# below) so that RDS never gains outbound internet capability even
# temporarily during a live contest. See live_contest/nat.tf for the
# full reasoning.
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = { Name = "quizbuzz-private-${count.index}", Tier = "database-isolated" }
}

# ─────────────────────────────────────────────────────────────────────────────
# PRIVATE SUBNETS (2 AZs) — QUIZ COMPUTE TIER (used only during live mode)
# For resources that must never be directly internet-reachable but DO need
# outbound internet access: quiz EC2s (pull Docker images from GHCR, call
# AWS SSM/CloudWatch/S3 APIs) and ElastiCache Redis (no outbound needed,
# but lives here for network proximity to the quiz EC2s it serves).
#
# WHY SEPARATE FROM THE DATABASE-TIER PRIVATE SUBNETS ABOVE:
# The live_contest module attaches a NAT Gateway route to whichever route
# table these subnets use. If quiz EC2s shared subnets with RDS, that NAT
# route would also grant RDS outbound internet access for the duration of
# every live contest — an unnecessary and avoidable security regression on
# the production database. Keeping them in dedicated subnets means RDS's
# "zero outbound internet, ever" guarantee holds unconditionally, while
# quiz EC2s in a DIFFERENT subnet can still reach RDS directly — subnets
# within the same VPC route to each other automatically; only security
# groups gate that traffic (RDS SG already allows the shared EC2 SG).
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_subnet" "quiz_private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 20}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = { Name = "quizbuzz-quiz-private-${count.index}", Tier = "quiz-compute" }
}

# Internet Gateway — the door between your VPC and the public internet.
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "quizbuzz-igw" }
}

# Public route table — sends all internet-bound traffic through the IGW.
# This is what makes a subnet "public."
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "quizbuzz-public-rt" }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Private route table — no internet route. Resources here are isolated.
# This table is used ONLY by the database-tier private subnets above.
# The quiz-compute-tier subnets get their own route table, created inside
# the live_contest module (only exists during live mode), so this table's
# "no internet, ever" guarantee is never modified by any other module.
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "quizbuzz-private-rt" }
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# Dedicated route table for quiz_private subnets.
# In idle mode, this route table has no route to the internet (isolated).
# In live mode, the live_contest module attaches a route to a NAT Gateway
# using an aws_route resource, granting outbound internet access only
# when needed.
resource "aws_route_table" "quiz_private" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "quizbuzz-quiz-private-rt" }
}

resource "aws_route_table_association" "quiz_private" {
  count          = 2
  subnet_id      = aws_subnet.quiz_private[count.index].id
  route_table_id = aws_route_table.quiz_private.id
}

# ─────────────────────────────────────────────────────────────────────────────
# SECURITY GROUPS
# Each SG is a named firewall ruleset attached to specific resources.
# Security groups are STATEFUL: if you allow inbound traffic in, the
# response is automatically allowed out — no separate outbound rule needed
# for responses.
# ─────────────────────────────────────────────────────────────────────────────

# EC2 SG — for the admin t2.small instance
resource "aws_security_group" "ec2" {
  name        = "quizbuzz-ec2-sg"
  description = "Admin EC2: SSH, backend API (3005), frontend (3000), HTTP/HTTPS"
  vpc_id      = aws_vpc.main.id

  # SSH — to log in and debug the server
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.your_ip]
    description = "SSH from developer machine"
  }

  # Backend Express + Socket.IO — port 3005
  # This is what quiz.ysminfosolution.com:3005 resolves to in idle mode.
  # In live mode, the ALB forwards to this port on the admin target group.
  # CHANGE: was 3000, now 3005 to match docker-compose.prod.yml
  ingress {
    from_port   = 3005
    to_port     = 3005
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Backend API + WebSocket (Express/Socket.IO)"
  }

  # Frontend Next.js — port 3000
  # CHANGE: was 3001, now 3000 to match docker-compose.prod.yml
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Frontend Next.js"
  }

  # HTTP — needed for SSL certificate validation (Let's Encrypt HTTP-01 challenge)
  # and for redirect to HTTPS if you add Nginx later
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  # HTTPS — if you terminate SSL on EC2 directly with Nginx or Caddy
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  # Allow all outbound — needed to pull Docker images from GHCR,
  # call AWS APIs (SSM, CloudWatch, S3), send emails, etc.
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "quizbuzz-ec2-sg" }
}

# RDS SG — for PostgreSQL
# ONLY the EC2 security group can reach port 5432.
# Nobody on the internet can reach the database directly — ever.
resource "aws_security_group" "rds" {
  name        = "quizbuzz-rds-sg"
  description = "RDS PostgreSQL: only reachable from EC2 SG"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
    description     = "PostgreSQL from EC2 instances only"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "quizbuzz-rds-sg" }
}

# ElastiCache SG — for Redis (used in live mode)
# Created now but only attached to ElastiCache in Week 3.
resource "aws_security_group" "elasticache" {
  name        = "quizbuzz-elasticache-sg"
  description = "ElastiCache Redis: only reachable from EC2 SG"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
    description     = "Redis from EC2 instances only"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "quizbuzz-elasticache-sg" }
}

# ALB SG — for Application Load Balancer (used in live mode)
# The ALB accepts public HTTP/HTTPS and routes to EC2s inside the VPC.
resource "aws_security_group" "alb" {
  name        = "quizbuzz-alb-sg"
  description = "ALB: accepts HTTP/HTTPS from internet"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP (redirect to HTTPS)"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "quizbuzz-alb-sg" }
}

# ─────────────────────────────────────────────────────────────────────────────
# OUTPUTS — values passed to other modules
# ─────────────────────────────────────────────────────────────────────────────
output "vpc_id"                  { value = aws_vpc.main.id }
output "public_subnet_ids"       { value = aws_subnet.public[*].id }

output "private_subnet_ids" {
  value       = aws_subnet.private[*].id
  description = "Database-tier subnets — RDS only, never has outbound internet"
}

output "quiz_private_subnet_ids" {
  value       = aws_subnet.quiz_private[*].id
  description = "Quiz-compute-tier subnets — used by live_contest module for quiz EC2s and ElastiCache"
}

output "ec2_sg_id"               { value = aws_security_group.ec2.id }
output "rds_sg_id"               { value = aws_security_group.rds.id }
output "elasticache_sg_id"       { value = aws_security_group.elasticache.id }
output "alb_sg_id"               { value = aws_security_group.alb.id }

output "quiz_route_table_id" {
  value       = aws_route_table.quiz_private.id
  description = "Quiz private route table ID — used by live_contest to inject/remove the NAT route"
}
