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

# TEMPORARY — only needed during the Multi-AZ relocation migration below.
# The instance's ENI is currently, physically attached to exactly ONE of
# your two original private subnets (confirmed directly by AWS's own error
# message when we tried to remove it: "subnet ... currently in use"). This
# is that ONE subnet — deliberately singular, not the whole private_subnets
# list, because keeping the OTHER (unused) private subnet out of the group
# entirely is what makes the Multi-AZ standby placement deterministic
# instead of a guess. See the MIGRATION PLAN comment above
# aws_db_subnet_group.main for the full reasoning.
variable "active_private_subnet_id" {
  description = "The single private subnet the RDS instance is currently, physically attached to. Remove this variable and this migration's extra subnet once the Multi-AZ relocation is complete and the group has been narrowed to public-only."
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
# WHY THIS IS A MULTI-AZ-FAILOVER MIGRATION, NOT A SIMPLE SUBNET SWAP:
# AWS blocks both naive approaches. (1) Editing this group's subnet_ids to
# remove the private subnets outright fails with "subnet ... currently in
# use" — you can't shrink a group out from under a live instance's actual
# ENI. (2) Pointing the instance at a completely different, separate
# subnet group fails with "InvalidVPCNetworkStateFault" — AWS reserves
# that ModifyDBInstance path for moving an instance to a DIFFERENT VPC,
# not for same-VPC relocation. The supported same-VPC mechanism is a
# temporary Multi-AZ standby + forced failover: AWS creates a second copy
# of the instance in a different AZ, and failing over to it physically
# relocates "the instance" without ever violating either restriction above.
#
# WHY subnet_ids BELOW IS EXACTLY [public[0], public[1], active_private] —
# NOT public + BOTH original private subnets:
# The instance's ENI is only physically attached to ONE specific private
# subnet right now (var.active_private_subnet_id — confirmed directly by
# AWS's own "currently in use" error, which named this exact subnet). The
# OTHER original private subnet is unused and deliberately excluded here.
# That makes this group span its 2 AZs asymmetrically: the active
# subnet's AZ has TWO options (active_private + the public subnet sharing
# that AZ), while the OTHER AZ has exactly ONE option (its public subnet).
# When Multi-AZ is enabled below, AWS must place the standby in the AZ
# DIFFERENT from wherever the current primary sits — and since that other
# AZ has only one subnet in this group, AWS has no choice but to put the
# standby in a public subnet. No guessing, no risk of landing back in a
# private subnet, unlike an even 2-and-2 subnet split would risk.
#
# MIGRATION STEPS — separate applies, do not combine:
#   1. Apply now: only this subnet group's membership changes (drops the
#      unused private subnet, adds both public ones; keeps the active
#      private subnet so the currently-running instance has zero diff).
#      multi_az is still false in this apply — confirm this step alone
#      succeeds before touching multi_az at all.
#   2. Separate apply: flip multi_az to true (below). AWS provisions the
#      standby. Afterwards, verify (via AWS Console → RDS → your instance
#      → Connectivity & security, or `aws rds describe-db-instances`)
#      that the standby is in the public subnet before proceeding.
#   3. Manual AWS CLI step (not Terraform): trigger the actual relocation —
#      `aws rds reboot-db-instance --db-instance-identifier quizbuzz-postgres --force-failover`
#      This promotes the standby (in the public subnet) to primary. Expect
#      a brief (60-120s) connection interruption, same as a normal failover.
#   4. Separate apply: flip multi_az back to false, and narrow subnet_ids
#      to just var.public_subnets (drop active_private_subnet_id and this
#      variable/comment entirely) — by then nothing needs the old private
#      subnet anymore.
resource "aws_db_subnet_group" "main" {
  name        = "quizbuzz-rds-subnet-group"
  subnet_ids  = concat(var.public_subnets, [var.active_private_subnet_id])
  description = "Subnet group for QuizBuzz RDS - Multi-AZ relocation in progress: 2 public subnets + the one private subnet the instance is still physically attached to"

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

  # STEP 2 (this apply): flip to true. This provisions a standby in a
  # different AZ from the primary. Because the subnet group above only
  # offers ONE subnet in that other AZ (a public one — see the group's
  # comment for why), the standby is forced into a public subnet. AFTER
  # this apply completes, verify that in the AWS Console (RDS → your
  # instance → "Connectivity & security" tab shows the standby's AZ; or
  # "Maintenance & backups"/"Configuration" tab may show it too) BEFORE
  # proceeding to the manual failover step (step 3, AWS CLI, not
  # Terraform): `aws rds reboot-db-instance --db-instance-identifier
  # quizbuzz-postgres --force-failover`. Do not trigger that failover
  # until you've confirmed the standby's subnet/AZ matches the public
  # subnet's AZ.
  multi_az = true

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
