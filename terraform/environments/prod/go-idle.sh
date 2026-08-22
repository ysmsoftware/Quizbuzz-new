#!/bin/bash
set -e

clear

echo "========================================================="
echo "            TRANSITIONING TO IDLE CONTEST MODE            "
echo "========================================================="
echo "WARNING: This will destroy the following resources:"
echo " 1. Application Load Balancer (ALB)"
echo " 2. Auto Scaling Group (ASG) & Quiz EC2 instances"
echo " 3. ElastiCache Redis replication group"
echo " 4. NAT Gateway & Elastic IP for quiz tier"
echo "========================================================="
echo ""

read -p "Are you sure you want to proceed and tear down live mode? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted. Infrastructure remains in Live Mode."
  exit 0
fi


# ── MIGRATE BULLMQ JOBS: ElastiCache → idle Redis container ────────────────
# Source: ElastiCache (current REDIS_HOST in .env)
# Dest:   127.0.0.1:6379 (local Redis container)
echo "▶ Migrating remaining BullMQ jobs from ElastiCache → local Redis..."

ADMIN_INSTANCE_ID=$(terraform output -raw instance_id 2>/dev/null) || true
REDIS_HOST=$(terraform output -raw redis_primary_endpoint 2>/dev/null) || true

if [ -n "$ADMIN_INSTANCE_ID" ] && [ -n "$REDIS_HOST" ] && [ "$REDIS_HOST" != "null" ]; then
  SCRIPT_PATH="$(dirname "$0")/../../../load-testing/scripts/redis-migrate.js"
  if [ -f "$SCRIPT_PATH" ]; then
    SCRIPT_CONTENT=$(cat "$SCRIPT_PATH" | base64 | tr -d '\n')
    MIGRATE_CMD_ID=$(aws ssm send-command \
      --region ap-south-1 \
      --instance-ids "$ADMIN_INSTANCE_ID" \
      --document-name "AWS-RunShellScript" \
      --parameters commands="[
        \"echo '$SCRIPT_CONTENT' | base64 -d > /tmp/redis-migrate.js\",
        \"docker cp /tmp/redis-migrate.js quizbuzz_backend:/app/redis-migrate.js\",
        \"docker exec quizbuzz_backend node /app/redis-migrate.js --from $REDIS_HOST:6379 --to 127.0.0.1:6379 --prefix quizbuzz --execute 2>&1 || echo MIGRATION_FAILED\"
      ]" \
      --query "Command.CommandId" \
      --output text 2>/dev/null) || true

    if [ -n "$MIGRATE_CMD_ID" ]; then
      aws ssm wait command-executed \
        --command-id "$MIGRATE_CMD_ID" \
        --instance-id "$ADMIN_INSTANCE_ID" \
        --region ap-south-1 || true
      MIGRATION_OUTPUT=$(aws ssm get-command-invocation \
        --command-id "$MIGRATE_CMD_ID" \
        --instance-id "$ADMIN_INSTANCE_ID" \
        --region ap-south-1 \
        --query 'StandardOutputContent' \
        --output text 2>/dev/null || echo "")
      if echo "$MIGRATION_OUTPUT" | grep -q "MIGRATION_FAILED"; then
        echo "ERROR: Redis migration reported failure. Check SSM output above."
        echo "       ElastiCache will NOT be destroyed — data may still be needed."
        echo "       Fix the migration error and re-run go-idle.sh."
        exit 1
      fi
      echo "✔ BullMQ migration complete (ElastiCache → local Redis)"
    else
      echo "ERROR: Could not dispatch reverse migration via SSM."
      echo "       ElastiCache will NOT be destroyed — fix SSM and re-run go-idle.sh."
      exit 1
    fi
  else
    echo "ERROR: redis-migrate.js not found at $SCRIPT_PATH"
    echo "       Cannot safely destroy ElastiCache — jobs may still be in it."
    echo "       Expected path relative to repo root: load-testing/scripts/redis-migrate.js"
    exit 1
  fi
else
  echo "WARNING: Could not determine ElastiCache endpoint — skipping reverse migration."
fi
echo ""

# ── SWITCH ADMIN INSTANCE BACK TO LOCAL REDIS ───────────────────────────────
echo "▶ Switching admin instance back to local Redis..."

ADMIN_INSTANCE_ID=$(terraform output -raw instance_id)

COMMAND_ID=$(aws ssm send-command \
  --region ap-south-1 \
  --instance-ids "$ADMIN_INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters commands='[
    "REDIS_PASS=$(aws ssm get-parameter --name /quizbuzz/prod/REDIS_PASSWORD --with-decryption --query Parameter.Value --output text --region ap-south-1) && sed -i \"s|^REDIS_HOST=.*|REDIS_HOST=redis|\" /app/.env && sed -i \"s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$REDIS_PASS|\" /app/.env",
    "cd /app && docker compose up -d --force-recreate backend worker",
    "sleep 15",
    "docker ps",
    "echo --- REDIS_HOST confirmation --- && grep REDIS_HOST /app/.env"
  ]' \
  --query "Command.CommandId" \
  --output text)

aws ssm wait command-executed \
  --command-id "$COMMAND_ID" \
  --instance-id "$ADMIN_INSTANCE_ID" \
  --region ap-south-1 || true

echo "✔ Admin instance back on local Redis"
echo ""

echo "Initiating terraform apply for idle mode..."
terraform apply -var-file="terraform.tfvars" -var="mode=idle" -auto-approve

# ── ENSURE LET'S ENCRYPT CERTIFICATE EXISTS (OR GENERATE IN IDLE MODE) ────────
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
  echo "⚠️  Admin instance is currently using a self-signed SSL certificate fallback."

  # Wait for DNS to point back to the Elastic IP. Read from Terraform's own
  # output rather than a hardcoded IP — this used to be a literal
  # "65.1.26.101" string, which would silently check against the wrong
  # address (and wait the full 5 minutes for a DNS state that already
  # matched) if the Elastic IP were ever reassigned or reallocated.
  ELASTIC_IP=$(terraform output -raw elastic_ip)
  echo "▶ Waiting for DNS $DOMAIN_NAME to resolve to Elastic IP $ELASTIC_IP..."
  for i in {1..30}; do
    RESOLVED_IP=$(python3 -c "import socket; print(socket.gethostbyname('$DOMAIN_NAME'))" 2>/dev/null || python -c "import socket; print(socket.gethostbyname('$DOMAIN_NAME'))" 2>/dev/null || echo "")
    if [ "$RESOLVED_IP" = "$ELASTIC_IP" ]; then
      echo "✔ DNS propagated successfully to $ELASTIC_IP."
      break
    fi
    echo "  DNS resolves to: ${RESOLVED_IP:-None} (Retrying in 10s... $i/30)"
    sleep 10
  done
  
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
echo "========================================================="
echo "              TERRAFORM APPLY SUCCESSFUL                 "
echo "========================================================="
echo ""
# DNS: nothing manual left to do — the `terraform apply` above already
# flipped the Route53 record for $DOMAIN_NAME back to a plain A record at
# the admin EC2's Elastic IP (terraform/modules/dns — aws_route53_record.api,
# driven automatically by var.mode). Hostinger's nameservers point at this
# Route53 zone permanently; there is no registrar-side step. (This used to
# print "update host.co.in" instructions — stale leftover from before the
# `dns` module automated this; following it today would point the domain
# somewhere Terraform doesn't manage and fight with on the next apply.)
echo "✔ DNS already switched back to the admin Elastic IP ($(terraform output -raw elastic_ip)) by Terraform."
echo "========================================================="
echo "Transition complete. System is now running in Idle Mode."
echo "========================================================="
