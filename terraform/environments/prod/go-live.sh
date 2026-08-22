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

# ── MIGRATE BULLMQ JOBS: idle Redis container → ElastiCache ─────────────
echo "▶ Migrating BullMQ jobs from local Redis → ElastiCache..."

REDIS_HOST=$(terraform output -raw redis_primary_endpoint)
ADMIN_INSTANCE_ID=$(terraform output -raw instance_id)

if [ -z "$REDIS_HOST" ] || [ "$REDIS_HOST" = "null" ]; then
  echo "ERROR: Could not read redis_primary_endpoint. Aborting migration."
  exit 1
fi

# Copy the migration script to the admin instance
SCRIPT_PATH="$(dirname "$0")/../../../load-testing/scripts/redis-migrate.js"
if [ ! -f "$SCRIPT_PATH" ]; then
  echo "ERROR: redis-migrate.js not found at $SCRIPT_PATH"
  echo "       This file must exist before going live — BullMQ jobs cannot be migrated without it."
  echo "       Expected path relative to repo root: load-testing/scripts/redis-migrate.js"
  exit 1
else
  # Upload script to admin EC2 and run it inside the backend container
  # 1. Copy script content via SSM (avoids needing SCP/SSH key access)
  # 2. docker cp into the backend container
  # 3. Run with node — ioredis is already in node_modules
  SCRIPT_CONTENT=$(cat "$SCRIPT_PATH" | base64 | tr -d '\n')
  MIGRATE_CMD_ID=$(aws ssm send-command \
    --region ap-south-1 \
    --instance-ids "$ADMIN_INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters commands="[
      \"echo '$SCRIPT_CONTENT' | base64 -d > /tmp/redis-migrate.js\",
      \"docker cp /tmp/redis-migrate.js quizbuzz_backend:/app/redis-migrate.js\",
      \"docker exec quizbuzz_backend node /app/redis-migrate.js --from 127.0.0.1:6379 --to $REDIS_HOST:6379 --prefix quizbuzz --execute 2>&1 || echo MIGRATION_FAILED\"
    ]" \
    --query "Command.CommandId" \
    --output text 2>/dev/null) || true

  if [ -n "$MIGRATE_CMD_ID" ]; then
    aws ssm wait command-executed \
      --command-id "$MIGRATE_CMD_ID" \
      --instance-id "$ADMIN_INSTANCE_ID" \
      --region ap-south-1 || true
    # Check the output for MIGRATION_FAILED sentinel written by the script
    MIGRATION_OUTPUT=$(aws ssm get-command-invocation \
      --command-id "$MIGRATE_CMD_ID" \
      --instance-id "$ADMIN_INSTANCE_ID" \
      --region ap-south-1 \
      --query 'StandardOutputContent' \
      --output text 2>/dev/null || echo "")
    if echo "$MIGRATION_OUTPUT" | grep -q "MIGRATION_FAILED"; then
      echo "ERROR: Redis migration reported failure. Check SSM output above."
      echo "       Do NOT switch admin to ElastiCache until migration succeeds."
      exit 1
    fi
    echo "✔ BullMQ migration complete (idle Redis → ElastiCache)"
  else
    echo "ERROR: Could not dispatch migration via SSM. Aborting go-live."
    echo "       Fix SSM connectivity to the admin instance before retrying."
    exit 1
  fi
fi
echo ""

# ── SWITCH ADMIN INSTANCE TO ELASTICACHE ────────────────────────────────────
echo "▶ Switching admin instance to ElastiCache..."

REDIS_HOST=$(terraform output -raw redis_primary_endpoint)
ADMIN_INSTANCE_ID=$(terraform output -raw instance_id)

if [ -z "$REDIS_HOST" ] || [ "$REDIS_HOST" = "null" ]; then
  echo "ERROR: Could not read redis_primary_endpoint from Terraform output. Admin instance NOT switched — fix this before sending real traffic."
  exit 1
fi

COMMAND_ID=$(aws ssm send-command \
  --region ap-south-1 \
  --instance-ids "$ADMIN_INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters commands="[
    \"sed -i 's|^REDIS_HOST=.*|REDIS_HOST=$REDIS_HOST|' /app/.env\",
    \"sed -i 's|^REDIS_PASSWORD=.*|REDIS_PASSWORD=|' /app/.env\",
    \"cd /app && docker compose up -d --force-recreate backend worker\",
    \"sleep 15\",
    \"docker ps\",
    \"echo '--- REDIS_HOST confirmation ---' && grep REDIS_HOST /app/.env\"
  ]" \
  --query "Command.CommandId" \
  --output text)

aws ssm wait command-executed \
  --command-id "$COMMAND_ID" \
  --instance-id "$ADMIN_INSTANCE_ID" \
  --region ap-south-1 || true

echo "✔ Admin instance switched to ElastiCache: $REDIS_HOST"
echo ""

# ── ENSURE LET'S ENCRYPT CERTIFICATE EXISTS ──────────────────────────────────
echo "▶ Checking SSL certificate status on admin instance..."
DOMAIN_NAME=$(grep "domain_name" terraform.tfvars | cut -d'"' -f2)

CERT_CHECK_CMD_ID=$(aws ssm send-command \
  --region ap-south-1 \
  --instance-ids "$ADMIN_INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters commands="[
    \"if [ -d /etc/letsencrypt/live/$DOMAIN_NAME ] && openssl x509 -in /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem -text -noout 2>/dev/null | grep -q 'Issuer:.*Let\'\\''s Encrypt'; then echo 'REAL'; else echo 'SELF_SIGNED'; fi\"
  ]" \
  --query "Command.CommandId" \
  --output text)

aws ssm wait command-executed \
  --command-id "$CERT_CHECK_CMD_ID" \
  --instance-id "$ADMIN_INSTANCE_ID" \
  --region ap-south-1 || true

CERT_STATUS=$(aws ssm get-command-invocation \
  --command-id "$CERT_CHECK_CMD_ID" \
  --instance-id "$ADMIN_INSTANCE_ID" \
  --region ap-south-1 \
  --query 'StandardOutputContent' \
  --output text 2>/dev/null || echo "SELF_SIGNED")

if echo "$CERT_STATUS" | grep -q "SELF_SIGNED"; then
  echo "⚠️  Admin instance is using a self-signed SSL certificate fallback."
  echo "▶ Requesting a real Let's Encrypt SSL certificate for $DOMAIN_NAME..."
  
  CERTBOT_CMD_ID=$(aws ssm send-command \
    --region ap-south-1 \
    --instance-ids "$ADMIN_INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters commands="[
      \"sudo certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos --email support@ysminfosolution.com --reinstall --expand\",
      \"sudo systemctl restart nginx\"
    ]" \
    --query "Command.CommandId" \
    --output text)
    
  aws ssm wait command-executed \
    --command-id "$CERTBOT_CMD_ID" \
    --instance-id "$ADMIN_INSTANCE_ID" \
    --region ap-south-1 || true
    
  echo "✔ SSL certificate updated to Let's Encrypt!"
else
  echo "✔ Valid Let's Encrypt SSL certificate is active."
fi
echo ""

# ── DNS: nothing manual left to do ──────────────────────────────────────────
# The `terraform apply` above already flipped the Route53 record for
# $DOMAIN_NAME to an ALIAS pointing at this ALB (see terraform/modules/dns —
# aws_route53_record.api, driven automatically by var.mode). There is no
# registrar-side step: Hostinger's nameservers point at this Route53 zone
# permanently, and Route53 itself is the thing Terraform just updated.
#
# (Earlier versions of this script printed manual "update host.co.in to a
# CNAME/A record" instructions here — that was leftover from before the
# `dns` module existed and automated this. Following those stale
# instructions today would be actively wrong: it would point the domain at
# a CNAME/A record instead of the ALIAS record Terraform manages, which is
# very likely what caused the "containers healthy but site unreachable"
# incidents — DNS pointing somewhere Terraform doesn't know about and will
# fight with on the next apply.)
echo "▶ Verifying DNS has switched to the ALB..."
DOMAIN_NAME=$(grep "domain_name" terraform.tfvars | cut -d'"' -f2)
for i in {1..12}; do
  RESOLVED=$(dig +short "$DOMAIN_NAME" 2>/dev/null | tail -1)
  ALB_IPS=$(dig +short "$ALB_DNS" 2>/dev/null)
  if [ -n "$RESOLVED" ] && echo "$ALB_IPS" | grep -q "^$RESOLVED$"; then
    echo "✔ $DOMAIN_NAME resolves to the ALB ($RESOLVED)."
    break
  fi
  echo "  Waiting for DNS to propagate to the ALB... ($i/12)"
  sleep 10
done
echo "========================================================="
echo "Transition complete. System is now running in Live Mode."
echo "========================================================="
