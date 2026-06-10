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
  fqdn    = "${var.api_subdomain}.${var.domain_name}"
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
  db_password     = var.db_password
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
  instance_type  = "t2.small"
  subnet_id      = module.networking.public_subnet_ids[0]
  ec2_sg_id      = module.networking.ec2_sg_id
  aws_region     = var.aws_region
  s3_bucket      = module.storage.bucket_name
  s3_bucket_arn  = module.storage.bucket_arn
  key_pair_name  = var.key_pair_name
  github_org     = var.github_org
}

##############################################################################
# OUTPUTS
# Values that are useful to see after `terraform apply`.
# Run `terraform output` to see them all.
# Run `terraform output -raw elastic_ip` to get just the IP.
##############################################################################
output "elastic_ip" {
  value       = module.admin_instance.elastic_ip
  description = "UPDATE YOUR DNS: Set quiz.ysminfosolution.com A record to this IP on host.co.in"
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
