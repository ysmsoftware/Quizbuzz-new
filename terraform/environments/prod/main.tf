##############################################################################
# WHAT THIS FILE DOES — ROOT MODULE (prod environment)
# ----------------------------------------
# This is the "assembly" file. All the modules you created (networking,
# database, storage, admin_instance) are like Lego blocks. This file
# picks them up and connects them together.
#
# HOW MODULE CALLS WORK:
#   module "networking" {
#     source = "../../modules/networking"  # path to the module folder
#     variable_name = value                # inputs to the module
#   }
#
#   After the module runs, you access its outputs with:
#   module.networking.vpc_id
#   module.networking.public_subnet_ids
#
# THE DEPENDENCY CHAIN:
#   networking → database (needs VPC subnets + RDS security group)
#   networking → storage  (no dependency, but created together)
#   networking + storage → admin_instance (needs subnet, SG, S3 bucket)
#
#   Terraform figures out this dependency order automatically because
#   database uses module.networking.private_subnet_ids — Terraform knows
#   it must create networking first.
#
# WHAT HAPPENS WHEN YOU RUN `terraform apply`:
#   1. Terraform reads all .tf files in this directory
#   2. Builds a dependency graph
#   3. Creates resources in parallel where possible
#   4. Shows you a plan: "X to add, Y to change, Z to destroy"
#   5. You confirm, then it creates everything
#   Total time for first apply: ~8-12 minutes (RDS takes the longest)
#
# WHAT HAPPENS ON SUBSEQUENT `terraform apply` RUNS:
#   Terraform compares current state (from S3 state file) to your .tf files.
#   Only changes what's different. If nothing changed, it does nothing.
#
# FUTURE CHANGES (what gets added here later):
#   - Week 3: Add `module "live_contest"` with count = local.is_live ? 1 : 0
#     This is the ALB + ElastiCache + ASG module, only created in live mode.
#   - Week 3: Add `module "monitoring"` for CloudWatch alarms
##############################################################################

locals {
  is_live = var.mode == "live"
  fqdn    = var.domain_name  # root domain — ysmquizbuzz.com, no subdomain

# ─────────────────────────────────────────────────────────────────────────
# DB PASSWORD — read from SSM by default, manual override only if set.
#
# WHY THIS EXISTS (real incident, see variables.tf db_password comment
# for full story): a manually-typed terraform apply password once drifted
# from what SSM's DATABASE_URL actually contained, silently changing
# RDS's real password while the connection string still had the old one.
# The backend crash-looped on every boot afterward with no obvious link
# back to the cause.
#
# coalesce() picks the FIRST non-null value: if you explicitly pass
# -var="db_password=..." it wins (emergency override path); otherwise
# this always reads /quizbuzz/prod/DB_MASTER_PASSWORD from SSM, which is
# now the single source of truth kept in sync with DATABASE_URL.
  db_password = coalesce(var.db_password, data.aws_ssm_parameter.db_master_password.value)
}

data "aws_ssm_parameter" "db_master_password" {
  name            = "/quizbuzz/prod/DB_MASTER_PASSWORD"
  with_decryption = true
}


##############################################################################
# MODULE: NETWORKING
# Creates: VPC, 2 public subnets, 2 private subnets, IGW, route tables,
#          4 security groups (EC2, RDS, ElastiCache, ALB)
##############################################################################
module "networking" {
  source  = "../../modules/networking"
  your_ip = var.your_ip
}

##############################################################################
# MODULE: DATABASE
# Creates: RDS PostgreSQL t3.micro in private subnets
# Depends on networking for: private_subnet_ids, rds_sg_id
#
# AFTER APPLY: Get the endpoint with `terraform output db_endpoint`
# Then manually build DATABASE_URL and store it in SSM.
##############################################################################
module "database" {
  source          = "../../modules/database"
  private_subnets = module.networking.private_subnet_ids
  rds_sg_id       = module.networking.rds_sg_id
  db_password     = local.db_password
}

##############################################################################
# MODULE: STORAGE
# Creates: S3 bucket for certificate PDFs and assets
# No dependencies on other modules.
##############################################################################
module "storage" {
  source = "../../modules/storage"
}

##############################################################################
# MODULE: ADMIN INSTANCE
# Creates: IAM role, Elastic IP, EC2 t2.small with userdata boot script
# Depends on networking for: public_subnet_ids[0], ec2_sg_id
# Depends on storage for: bucket_name, bucket_arn (for IAM policy)
##############################################################################
module "admin_instance" {
  source         = "../../modules/admin_instance"
  instance_type  = "t3.medium"
  subnet_id      = module.networking.public_subnet_ids[0]
  ec2_sg_id      = module.networking.ec2_sg_id
  aws_region     = var.aws_region
  s3_bucket      = module.storage.bucket_name
  s3_bucket_arn  = module.storage.bucket_arn
  key_pair_name  = var.key_pair_name
  github_org     = var.github_org
  domain         = local.fqdn
}

##############################################################################
# MODULE: DNS
# Creates Route53 hosted zone for quiz.ysminfosolution.com and manages A/ALIAS records
# pointing to either the t3.small EC2 (idle mode) or the ALB (live mode).
##############################################################################
module "dns" {
  source       = "../../modules/dns"
  zone_name    = var.domain_name
  fqdn         = local.fqdn
  is_live      = local.is_live
  aws_region   = var.aws_region
  admin_eip    = module.admin_instance.elastic_ip
  alb_dns_name = local.is_live ? module.live_contest[0].alb_dns_name : ""
  alb_zone_id  = local.is_live ? module.live_contest[0].alb_zone_id : ""
}

##############################################################################
# MODULE: LIVE CONTEST (ALB + ASG + ElastiCache Redis + NAT Gateway)
# Only created when mode = "live".
##############################################################################
module "live_contest" {
  count                = local.is_live ? 1 : 0
  source               = "../../modules/live_contest"
  vpc_id               = module.networking.vpc_id
  public_subnets       = module.networking.public_subnet_ids
  private_subnets      = module.networking.private_subnet_ids
  quiz_private_subnets = module.networking.quiz_private_subnet_ids
  quiz_route_table_id  = module.networking.quiz_route_table_id
  alb_sg_id            = module.networking.alb_sg_id
  ec2_sg_id            = module.networking.ec2_sg_id
  elasticache_sg_id    = module.networking.elasticache_sg_id

  # Calculate initial/desired instances: ~1 instance per 1000 users.
  # Clamp between 2 and 10 to ensure high availability while capping cost.
  desired_capacity     = ceil(var.expected_participants / 1000) > 10 ? 10 : (ceil(var.expected_participants / 1000) < 2 ? 2 : ceil(var.expected_participants / 1000))

  aws_region        = var.aws_region
  s3_bucket         = module.storage.bucket_name
  github_org        = var.github_org
  domain            = local.fqdn
  admin_instance_id = module.admin_instance.instance_id
  acm_certificate_arn = module.dns.certificate_arn
}

##############################################################################
# OUTPUTS
# Values that are useful to see after `terraform apply`.
# Run `terraform output` to see them all.
# Run `terraform output -raw elastic_ip` to get just the IP.
##############################################################################
output "elastic_ip" {
  value       = module.admin_instance.elastic_ip
  description = "Elastic IP — admin EC2. Point Hostinger nameservers to Route 53 instead of using this directly."
}

output "dns_name_servers" {
  value       = module.dns.name_servers
  description = "Set these 4 nameservers in Hostinger for ysmquizbuzz.com (Change Nameservers)"
}

output "instance_id" {
  value       = module.admin_instance.instance_id
  description = "EC2 Instance ID — used in GitHub Actions for SSM Run Command deploys"
}

output "db_endpoint" {
  value       = module.database.db_endpoint
  description = "RDS endpoint — use this to build your DATABASE_URL for SSM"
}

output "db_username" {
  value       = module.database.db_username
  description = "RDS master username (quizbuzz_admin)"
}

output "s3_bucket" {
  value       = module.storage.bucket_name
  description = "S3 bucket name for S3_BUCKET env var"
}

output "alb_dns_name" {
  value       = local.is_live ? module.live_contest[0].alb_dns_name : ""
  description = "Application Load Balancer DNS name (live mode only)"
}

output "redis_primary_endpoint" {
  value       = local.is_live ? module.live_contest[0].redis_primary_endpoint : ""
  description = "ElastiCache Redis primary endpoint (live mode only)"
}

