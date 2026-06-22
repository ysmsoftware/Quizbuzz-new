#!/bin/bash
set -e

# Clear screen for readability
clear

echo "========================================================="
echo "            TRANSITIONING TO LIVE CONTEST MODE            "
echo "========================================================="
echo "This script will provision:"
echo " 1. Application Load Balancer (ALB) - Public entry point"
echo " 2. Auto Scaling Group (ASG) - Quiz compute instances"
echo " 3. ElastiCache Redis - Shared state/pubsub/queue cluster"
echo " 4. NAT Gateway - Outbound connectivity for quiz instances"
echo "========================================================="
echo ""


# ─────────────────────────────────────────────────────────────────────────
# DB PASSWORD: deliberately NOT prompted for here anymore.
#
# WHY THIS CHANGED (real recurring incident): every time this script
# prompted for db_password manually, there was a real chance of typing a
# stale or slightly different password than what SSM's DATABASE_URL
# actually contained. Since db_password feeds RDS's actual master
# password (apply_immediately = true in the database module), a single
# mistyped character would silently change RDS's real password while
# DATABASE_URL in SSM kept the OLD one — causing every backend container
# across the fleet to crash-loop on P1000 authentication failures, with
# no obvious link back to "I typed it wrong on this one apply." This
# happened more than once and cost real debugging time disconnected from
# any actual code or infrastructure problem.
#
# root main.tf now reads db_password automatically from SSM
# (/quizbuzz/prod/DB_MASTER_PASSWORD) via coalesce(var.db_password, ...),
# where var.db_password defaults to null. As long as nothing sets
# TF_VAR_db_password or passes -var="db_password=...", Terraform always
# reads the SSM value — the SAME source DATABASE_URL is built from — so
# the two can never drift apart through this script again.
#
# If you ever genuinely need to ROTATE the password, do it explicitly
# and deliberately, OUTSIDE this script:
#   aws ssm put-parameter --name "/quizbuzz/prod/DB_MASTER_PASSWORD" \
#     --value "NewPassword123!" --type SecureString --overwrite
#   aws rds modify-db-instance --db-instance-identifier quizbuzz-postgres \
#     --master-user-password "NewPassword123!" --apply-immediately
#   (then update DATABASE_URL in SSM to match, in the same sitting)
# Never via an interactive prompt buried inside a routine mode-switch.
# ────────────────────────────────────────────────────────────────────────
echo "Initiating terraform apply for live mode..."
terraform apply -var-file="terraform.tfvars" -var="mode=live" -auto-approve

echo ""
echo "========================================================="
echo "              TERRAFORM APPLY SUCCESSFUL                 "
echo "========================================================="
echo ""

# Fetch outputs
ALB_DNS=$(terraform output -raw alb_dns_name)

if [ -z "$ALB_DNS" ] || [ "$ALB_DNS" = "null" ]; then
  echo "WARNING: Could not retrieve ALB DNS Name from Terraform outputs."
  exit 0
fi

echo "--------------------------------------------------------"
echo " ALB DNS NAME (Recommended CNAME target):"
echo " $ALB_DNS"
echo "--------------------------------------------------------"
echo ""

echo "Resolving ALB DNS Name to current IP addresses..."
IPS=""
if command -v dig &> /dev/null; then
  IPS=$(dig +short "$ALB_DNS" | grep -E '^[0-9.]+$')
elif command -v nslookup &> /dev/null; then
  IPS=$(nslookup "$ALB_DNS" | awk '/^Address: / { print $2 }' | grep -v '#')
  if [ -z "$IPS" ]; then
    IPS=$(nslookup "$ALB_DNS" | grep -A 2 -i "Name:" | grep -i "Address" | awk '{print $2}' | grep -E '^[0-9.]+$')
  fi
fi

if [ -n "$IPS" ]; then
  echo "Current resolved IP addresses for the ALB:"
  echo "$IPS"
  echo "--------------------------------------------------------"
  echo "ACTION REQUIRED:"
  echo "1. Recommended: Update your DNS provider (e.g. host.co.in) to use a CNAME"
  echo "   record pointing your subdomain (quiz.ysminfosolution.com) to:"
  echo "   $ALB_DNS"
  echo "2. Alternative (A Records): Point your A record to these resolved IP(s):"
  echo "   (Note: ALB IPs can change, CNAME is highly recommended)"
  echo "   $IPS"
else
  echo "ACTION REQUIRED:"
  echo "Update your DNS provider (e.g. host.co.in) to point a CNAME for"
  echo "quiz.ysminfosolution.com to the ALB DNS name:"
  echo "   $ALB_DNS"
fi
echo "========================================================="
echo "Transition complete. System is now running in Live Mode."
echo "========================================================="
