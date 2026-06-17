# ADMIN INSTANCE MODULE

variable "subnet_id"     { description = "Public subnet ID for the admin EC2" }
variable "ec2_sg_id"     { description = "Security group ID for EC2" }
variable "aws_region"    { description = "AWS region" }
variable "s3_bucket"     { description = "S3 bucket name for certificates" }
variable "s3_bucket_arn" { description = "S3 bucket ARN for IAM policy" }
variable "instance_type" {
  default     = "t2.small"
  description = "EC2 instance type. t2.small = 1vCPU, 2GB."
}
variable "key_pair_name" {
  description = "Name of the SSH key pair. Must exist in AWS Console before apply."
}
variable "github_org" {
  description = "GitHub username/org for GHCR image URLs (e.g. ysmsoftware)"
}

# ─────────────────────────────────────────────────────────────────────────────
# TERRAFORM REQUIRED PROVIDERS
# cloudinit is needed for gzip-compressing the userdata script.
# Without this block, Terraform uses the hashicorp/cloudinit provider but
# may not find it if it wasn't explicitly declared in backend.tf.
# ─────────────────────────────────────────────────────────────────────────────
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    cloudinit = {
      source  = "hashicorp/cloudinit"
      version = "~> 2.0"
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# IAM ROLE FOR EC2
# Gives this EC2 permission to:
#   - Read secrets from SSM Parameter Store
#   - Receive SSM Run Commands (for CI/CD deploys without SSH)
#   - Write logs to CloudWatch
#   - Access the S3 bucket for certificates
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_iam_role" "ec2" {
  name        = "quizbuzz-admin-ec2-role"
  description = "Allows the QuizBuzz admin EC2 to access SSM, S3, and CloudWatch"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm_read" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess"
}

# SSM Core: allows EC2 to receive SSM Run Commands from GitHub Actions
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "cloudwatch" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# S3 access scoped to only the QuizBuzz bucket (least privilege)
resource "aws_iam_role_policy" "s3_access" {
  name = "quizbuzz-s3-access"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ]
      Resource = [
        var.s3_bucket_arn,
        "${var.s3_bucket_arn}/*"
      ]
    }]
  })
}

# CloudWatch Logs scoped to the /quizbuzz/ log group prefix
resource "aws_iam_role_policy" "cloudwatch_logs" {
  name = "quizbuzz-cloudwatch-logs"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ]
      Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/quizbuzz/*"
    }]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "quizbuzz-admin-ec2-profile"
  role = aws_iam_role.ec2.name
}

# ─────────────────────────────────────────────────────────────────────────────
# ELASTIC IP
# A permanent public IP that stays the same even if the EC2 is stopped/started.
# This is what you point the DNS A record at on host.co.in.
# Cost: FREE while attached to a running instance.
# ─────────────────────────────────────────────────────────────────────────────
data "aws_eip" "admin" {
  public_ip = "65.1.26.101"
}

resource "aws_eip_association" "admin" {
  instance_id   = aws_instance.admin.id
  allocation_id = data.aws_eip.admin.id
}

# ─────────────────────────────────────────────────────────────────────────────
# AMI — latest Amazon Linux 2023 (x86_64)
# Using a data source instead of a hardcoded AMI ID means this always picks
# the latest patched image regardless of region or time.
# ─────────────────────────────────────────────────────────────────────────────
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# USERDATA — gzip compressed via cloudinit_config
#
# WHY GZIP?
# EC2 userdata has a hard 16KB limit for plain text. Our boot script with
# all the env variables and compose file content exceeds this. Gzip brings
# it well under the limit. The EC2 automatically decompresses it on boot.
#
# templatefile() substitutes Terraform variables (${aws_region}, ${domain},
# ${github_org}, ${s3_bucket}) before the script runs on the EC2.
# Shell variables ($INSTANCE_ID, $IMAGE_TAG etc.) are NOT substituted here —
# they're evaluated at runtime on the EC2.
# ─────────────────────────────────────────────────────────────────────────────
data "cloudinit_config" "admin_config" {
  gzip          = true
  base64_encode = true

  part {
    content_type = "text/x-shellscript"
    content = templatefile("${path.module}/userdata.sh.tpl", {
      aws_region = var.aws_region
      s3_bucket  = var.s3_bucket
      github_org = var.github_org
      domain     = "quiz.ysminfosolution.com"
    })
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# EC2 INSTANCE
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_instance" "admin" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [var.ec2_sg_id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  key_name               = var.key_pair_name

  root_block_device {
    # Minimum 30GB — Amazon Linux 2023 AMI snapshot requires at least 30GB.
    # Previously 20GB caused: "InvalidBlockDeviceMapping: expect size >= 30GB"
    volume_size           = 30
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  # IMDSv2 ENFORCEMENT
  # WHY: Amazon Linux 2023 defaults to requiring IMDSv2 (token-based metadata).
  # IMDSv1 (plain curl to 169.254.169.254) returns HTTP 401 on these instances.
  # The userdata script uses the two-step IMDSv2 curl to get the instance ID.
  # This block makes the requirement explicit in Terraform so it's consistent
  # regardless of account-level IMDS settings.
  #
  # http_tokens = "required"     → IMDSv2 only, IMDSv1 returns 401
  # http_put_response_hop_limit  → 2 allows containers to also use IMDS
  #   (hop limit 1 = only the EC2 itself; 2 = EC2 + one network hop = containers)
  metadata_options {
    http_tokens                 = "required"
    http_endpoint               = "enabled"
    http_put_response_hop_limit = 2
  }

  user_data_base64 = data.cloudinit_config.admin_config.rendered

  # IMPORTANT: changing user_data triggers instance replacement because
  # userdata only runs on first boot. Terraform will create the new instance
  # first (create_before_destroy), attach the EIP, then terminate the old one.
  # All state lives in RDS/S3/Redis so this is safe.
  tags = { Name = "quizbuzz-admin", Role = "admin", Mode = "idle" }

  lifecycle {
    create_before_destroy = true
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# OUTPUTS
# ─────────────────────────────────────────────────────────────────────────────
output "instance_id" {
  value       = aws_instance.admin.id
  description = "EC2 instance ID — used by CI/CD to send SSM Run Commands"
}

output "elastic_ip" {
  value       = data.aws_eip.admin.public_ip
  description = "Elastic IP — set quiz.ysminfosolution.com A record to this on host.co.in"
}

output "private_ip" {
  value       = aws_instance.admin.private_ip
  description = "Private IP — for internal VPC communication"
}
