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
