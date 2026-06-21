#!/bin/bash
set -e

# Clear screen for readability
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

# Ensure we have the DB password (needed to read/validate RDS state)
if [ -z "$TF_VAR_db_password" ]; then
  echo "RDS database password environment variable (TF_VAR_db_password) is not set."
  read -sp "Enter RDS database password: " db_pass
  echo ""
  if [ -z "$db_pass" ]; then
    echo "ERROR: Password cannot be empty."
    exit 1
  fi
  export TF_VAR_db_password="$db_pass"
fi

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
