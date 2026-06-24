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

# ─────────────────────────────────────────────────────────────────────────
# DB PASSWORD: deliberately NOT prompted for here anymore — same fix as
# go-live.sh, see that file's comment for the full incident history.
# main.tf reads /quizbuzz/prod/DB_MASTER_PASSWORD from SSM automatically.
# ─────────────────────────────────────────────────────────────────────────

# ── SWITCH ADMIN INSTANCE BACK TO LOCAL REDIS ───────────────────────────────
# Do this BEFORE the apply tears down ElastiCache — once the replication
# group is destroyed, the admin backend would otherwise crash-loop trying
# to reach a Redis host that no longer exists.
#
# IMPORTANT: Use --force-recreate (not restart) so Docker re-reads the
# updated .env values. `docker compose restart` reuses the existing
# container environment baked in at `up` time and ignores .env changes.
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

echo ""
echo "========================================================="
echo "              TERRAFORM APPLY SUCCESSFUL                 "
echo "========================================================="
echo ""
echo "ACTION REQUIRED:"
echo "Update your DNS provider (e.g. host.co.in) to point the A record for"
echo "quiz.ysminfosolution.com back to the Admin Elastic IP:"
echo "   65.1.26.101"
echo "========================================================="
echo "Transition complete. System is now running in Idle Mode."
echo "========================================================="
