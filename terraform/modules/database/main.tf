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

# TEMPORARY, ROUND 2 — needed again for one intermediate apply only.
# When multi_az was flipped back to false in the same apply as narrowing
# subnet_ids to public-only, AWS rejected the subnet-group shrink with
# "subnet ... currently in use" — because Terraform applies the subnet
# group change before the instance change (the instance depends on the
# subnet group's name), so at that moment multi_az was still true and the
# STANDBY (which AWS had placed back in this original private subnet when
# it rebuilt itself after the failover) was still physically occupying it.
# Fix: disable multi_az FIRST, by itself, with this subnet still present
# in the group so nothing needs removing yet. Once that apply succeeds
# (standby is torn down, confirm via Console/CLI), drop this variable and
# narrow subnet_ids to var.public_subnets in a second, separate apply —
# the same step 4b described in aws_db_subnet_group.main's comment below.
variable "active_private_subnet_id" {
  description = "The private subnet the standby is currently, physically occupying (same subnet as the original migration). Remove this variable once multi_az=false has been applied and the group can be narrowed safely."
  type        = string
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


# DB SUBNET GROUP
# RDS requires you to tell it WHICH subnets it's allowed to use.
#
# CHANGED FROM PRIVATE TO PUBLIC SUBNETS — deliberate decision, not drift:
# RDS previously lived in the isolated private-tier subnets (no route to an
# Internet Gateway), which meant it had literally no network path reachable
# from outside the VPC — not a firewall block, an absence of a route at all.
# That made the Ops dashboard VPS's direct Postgres access (see
# aws_security_group.rds's second ingress block in networking/main.tf)
# permanently non-functional no matter what the security group allowed.
# Moving to the public subnets (which do have an IGW route) combined with
# publicly_accessible = true below gives RDS a real, internet-routable
# endpoint — and now the security group is the ACTUAL gatekeeper: it allows
# exactly two sources (the EC2 security group for the main app, and the Ops
# VPS's single /32) and nothing else — no 0.0.0.0/0 rule exists on that
# security group. Do not add one.
#
# MIGRATION STATUS: the primary already failed over onto a public subnet
# and that part is done and confirmed. What's left is pure cleanup —
# getting multi_az back to false and this group narrowed to public-only.
# That cleanup itself turned out to need TWO separate applies, not one:
#
#   4a (THIS APPLY): disable multi_az only. Keep active_private_subnet_id
#      in subnet_ids for now. Reason: Terraform updates this subnet group
#      before the instance (the instance depends on this group's name),
#      so if subnet_ids were narrowed in the SAME apply as multi_az being
#      flipped, AWS would still see multi_az=true and reject the shrink
#      because the standby (which AWS re-created in this same private
#      subnet after the failover) is still physically sitting there —
#      this is exactly the error that happened when both changes were
#      attempted together. Disabling multi_az first tears the standby
#      down and frees the subnet.
#   4b (NEXT APPLY, separate): once 4a succeeds and you've confirmed via
#      Console/CLI that there's no secondary AZ / no standby left, remove
#      variable "active_private_subnet_id" from this file and from the
#      root module's module "database" block, and change subnet_ids back
#      to just var.public_subnets.
resource "aws_db_subnet_group" "main" {
  name        = "quizbuzz-rds-subnet-group"
  subnet_ids  = concat(var.public_subnets, [var.active_private_subnet_id])
  description = "Subnet group for QuizBuzz RDS - public subnets + standby's private subnet (cleanup step 4a, multi_az disable in progress)"

  tags = { Name = "quizbuzz-rds-subnet-group" }
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
  db_subnet_group_name   = aws_db_subnet_group.main.name
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

  # Cleanup step 4a (see aws_db_subnet_group.main's comment above): disable
  # multi_az now, by itself, to tear down the standby before the subnet
  # group is narrowed in a follow-up apply (step 4b). Re-enable this in
  # the future only as a deliberate HA decision, not as part of a migration.
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
