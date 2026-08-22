# DATABASE MODULE

# Creates a managed PostgreSQL database using AWS RDS (Relational Database
# Service). "Managed" means AWS handles: OS patches, engine upgrades,
# automated backups, monitoring — you just use the connection URL.

# FUTURE CHANGES
#   - Upgrade instance: change instance_class, run terraform apply
#   - Enable multi-AZ: change multi_az to true, run terraform apply
#   - Increase storage: max_allocated_storage handles this automatically
#   - Add read replica: add a second aws_db_instance with replicate_source_db
#   - Add PgBouncer: add a Docker container on the admin EC2 instance

variable "public_subnets" {
  description = "List of public subnet IDs for the RDS subnet group"
  type        = list(string)
}

# TEMPORARY — only needed during the private→public migration below.
# Remove this variable, the old aws_db_subnet_group.main resource, and this
# comment once the migration apply (see note above aws_db_subnet_group.main)
# has completed successfully and you've confirmed the instance is healthy
# on the new public subnet group.
variable "private_subnets" {
  description = "OLD subnet group's subnets, kept only so the pre-migration aws_db_subnet_group.main resource has zero diff during the migration apply. Safe to delete after migration."
  type        = list(string)
}

variable "rds_sg_id" {
  description = "Security group ID that allows PostgreSQL access from EC2"
  type        = string
}

variable "db_password" {
  description = "Master password for the RDS instance. Never commit this."
  type        = string
  sensitive   = true
}


# DB SUBNET GROUP(S)
# RDS requires you to tell it WHICH subnets it's allowed to use.
#
# CHANGED FROM PRIVATE TO PUBLIC SUBNETS — deliberate decision, not drift:
# RDS previously lived in the isolated private-tier subnets (no route to an
# Internet Gateway), which meant it had literally no network path reachable
# from outside the VPC — not a firewall block, an absence of a route at all.
# That made the Ops dashboard VPS's direct Postgres access (see
# aws_security_group.rds's second ingress block in networking/main.tf)
# permanently non-functional no matter what the security group allowed,
# since traffic from the VPS never had anywhere to arrive in the first
# place. Moving to the public subnets (which do have an IGW route) combined
# with publicly_accessible = true below gives RDS a real, internet-routable
# endpoint — and now the security group is the ACTUAL gatekeeper: it allows
# exactly two sources (the EC2 security group for the main app, and the Ops
# VPS's single /32) and nothing else — no 0.0.0.0/0 rule exists on that
# security group. Do not add one.
#
# WHY TWO SEPARATE aws_db_subnet_group RESOURCES INSTEAD OF EDITING ONE:
# AWS's ModifyDBSubnetGroup API refuses to remove any subnet that a running
# instance is currently, physically attached to ("subnet ... currently in
# use") — subnet-group membership and the instance's actual attached subnet
# are two different things, and you can't shrink a group out from under a
# live instance in one step. The supported way to relocate an instance is
# to point it at a DIFFERENT subnet group entirely (aws_db_instance.postgres
# below now references .public, not .main) — RDS handles the ENI move as
# part of that operation instead of rejecting it up front.
#
# MIGRATION STEPS (do these as two separate applies, not one):
#   1. Apply now: creates aws_db_subnet_group.public and moves the instance
#      onto it (db_subnet_group_name + publicly_accessible both change).
#      aws_db_subnet_group.main (private, original) is left completely
#      untouched in this apply so Terraform has no reason to touch it yet.
#   2. AFTER confirming step 1 succeeded and the instance is healthy: delete
#      the aws_db_subnet_group.main resource block below, the private_subnets
#      variable above, and the private_subnets wiring in
#      environments/prod/main.tf's module "database" block. By then nothing
#      references the old group, so Terraform can cleanly destroy it.
resource "aws_db_subnet_group" "main" {
  name        = "quizbuzz-rds-subnet-group"
  subnet_ids  = var.private_subnets
  description = "Subnet group for QuizBuzz RDS - private subnets in 2 AZs"

  tags = { Name = "quizbuzz-rds-subnet-group" }
}

# NEW — the public-subnet group the instance is migrating to. Separate
# resource/name from aws_db_subnet_group.main; see the migration note above.
resource "aws_db_subnet_group" "public" {
  name        = "quizbuzz-rds-subnet-group-public"
  subnet_ids  = var.public_subnets
  description = "Subnet group for QuizBuzz RDS - public subnets in 2 AZs (publicly_accessible, gated by security group allowlist only)"

  tags = { Name = "quizbuzz-rds-subnet-group-public" }
}


# THE ACTUAL RDS INSTANCE

resource "aws_db_instance" "postgres" {
 
  identifier = "quizbuzz-postgres"

  # Database engine settings
  engine         = "postgres"
  engine_version = "16.13"

  instance_class = "db.t3.micro"

  # Storage settings
  allocated_storage     = 20   
  max_allocated_storage = 100 
  storage_type          = "gp3"
  storage_encrypted     = true 

  # Database name and credentials
  db_name  = "quizbuzz"
  username = "quizbuzz_admin"
  password = var.db_password

  # Network placement — public subnets, security-group-gated
  #
  # publicly_accessible = true is intentional: RDS now has a real internet-
  # routable endpoint, but the security group (var.rds_sg_id) is a strict
  # allowlist of exactly two sources — the EC2 SG (main app) and the Ops
  # VPS's /32 — with no 0.0.0.0/0 rule anywhere on it. Reaching the network
  # layer does not bypass authentication: PostgreSQL still requires a valid
  # username/password for every connection regardless of where it comes
  # from. Keep the security group narrow — do not widen its CIDR beyond the
  # single Ops VPS IP, and never add a catch-all rule to "temporarily debug"
  # something; that single security group is now the only thing standing
  # between the internet and this database's login prompt.
  db_subnet_group_name   = aws_db_subnet_group.public.name
  vpc_security_group_ids = [var.rds_sg_id]
  publicly_accessible    = true

  # Automated backups
  backup_retention_period = 7
  backup_window           = "20:30-21:30"  # 2am IST = low traffic
  maintenance_window      = "Mon:21:30-Mon:22:30"

  # Performance Insights — free tier of query monitoring
  # Shows you which queries are slow. Keep this enabled.
  performance_insights_enabled          = true
  performance_insights_retention_period = 7  

  multi_az = false

  deletion_protection = true

  skip_final_snapshot       = false
  final_snapshot_identifier = "quizbuzz-postgres-final-snapshot"

  apply_immediately = true

  tags = { Name = "quizbuzz-postgres" }
}


# OUTPUTS

#
# Store this in SSM:
#   aws ssm put-parameter --name "/quizbuzz/prod/DATABASE_URL" \
#     --value "postgresql://quizbuzz_admin:YOUR_PASSWORD@<endpoint>/quizbuzz?schema=public" \
#     --type SecureString --region ap-south-1

output "db_endpoint" {
  value       = aws_db_instance.postgres.endpoint
  description = "RDS endpoint (host:port). Use this to build your DATABASE_URL."
}

output "db_name" {
  value = aws_db_instance.postgres.db_name
}

output "db_username" {
  value = aws_db_instance.postgres.username
}
