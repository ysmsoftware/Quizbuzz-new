# ADMIN INSTANCE MODULE

variable "domain" {
  description = "Fully qualified domain for this instance (e.g. ysmquizbuzz.com)"
  default     = "ysmquizbuzz.com"
}
variable "subnet_id"    { description = "Public subnet ID for the admin EC2" }
variable "ec2_sg_id"    { description = "Security group ID for EC2" }
variable "aws_region"   { description = "AWS region" }
variable "s3_bucket"    { description = "S3 bucket name for certificates" }
variable "s3_bucket_arn" { description = "S3 bucket ARN for IAM policy" }
variable "instance_type" {
  default     = "t3.medium"
  description = "EC2 instance type. t3.medium = 2vCPU, 4GB."
}
variable "key_pair_name" {
  description = "Name of the SSH key pair to attach. Must be created in AWS Console first."
}
variable "github_org" {
  description = "GitHub username/org for GHCR image URLs"
}


# IAM ROLE FOR EC2
resource "aws_iam_role" "ec2" {
  name        = "quizbuzz-admin-ec2-role"
  description = "Allows the QuizBuzz admin EC2 to access SSM, S3, and CloudWatch"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "ec2.amazonaws.com" }
      }
    ]
  })
}


resource "aws_iam_role_policy_attachment" "ssm_read" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess"
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "cloudwatch" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# ─────────────────────────────────────────────────────────────────────────────
# EC2 READ-ONLY DESCRIBE PERMISSION — required for Prometheus EC2 service
# discovery (ec2_sd_configs in prometheus.yml).
#
# WHY THIS IS NEEDED:
# Prometheus on the admin instance needs to dynamically discover quiz EC2
# instances as they're created/destroyed by the ASG — a static target
# list in prometheus.yml is impossible since those instances don't exist
# until live mode is applied, and get destroyed when it's torn down.
# ec2_sd_configs solves this by having Prometheus itself call the AWS API
# (ec2:DescribeInstances) on each scrape cycle to find instances matching
# a tag filter (Mode=live, Role=quiz — see asg.tf's tag_specifications).
#
# AmazonSSMReadOnlyAccess and CloudWatchAgentServerPolicy (above) do NOT
# grant ec2:Describe* — this is a distinct, narrowly-scoped read-only
# permission, safe to grant since it only allows LISTING instance
# metadata (IDs, tags, private IPs), never modifying anything.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_iam_role_policy" "ec2_describe" {
  name = "quizbuzz-admin-ec2-describe"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ec2:DescribeInstances",
        "ec2:DescribeTags"
      ]
      Resource = "*" # ec2:Describe* actions do not support resource-level restriction
   }]
  })
}

# S3
resource "aws_iam_role_policy" "s3_access" {
  name = "quizbuzz-s3-access"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
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
      }
    ]
  })
}

# CloudWatch Logs:
resource "aws_iam_role_policy" "cloudwatch_logs" {
  name = "quizbuzz-cloudwatch-logs"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/quizbuzz/*"
      }
    ]
  })
}

# Instance profile
resource "aws_iam_instance_profile" "ec2" {
  name = "quizbuzz-admin-ec2-profile"
  role = aws_iam_role.ec2.name
}

data "aws_eip" "admin" {
  public_ip = "65.1.26.101"
}

resource "aws_eip_association" "admin" {
  instance_id   = aws_instance.admin.id
  allocation_id = data.aws_eip.admin.id
}

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

# COMPRESS AND ENCODE USERDATA USING GZIP
data "cloudinit_config" "admin_config" {
  gzip          = true
  base64_encode = true

  part {
    content_type = "text/x-shellscript"
    content = templatefile("${path.module}/userdata.sh.tpl", {
      aws_region = var.aws_region
      s3_bucket  = var.s3_bucket
      github_org = var.github_org
      domain     = var.domain
    })
  }
}

# EC2 INSTANCE
resource "aws_instance" "admin" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [var.ec2_sg_id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  key_name               = var.key_pair_name

  # Root disk: 30GB encrypted SSD
  root_block_device {
    volume_size           = 30
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  # CHANGED: Swapped native base64encode for the gzipped data source
  user_data_base64 = data.cloudinit_config.admin_config.rendered

  tags = { Name = "quizbuzz-admin", Role = "admin", Mode = "idle" }

  lifecycle {
    create_before_destroy = true
  }
}

# OUTPUTS
output "instance_id" {
  value       = aws_instance.admin.id
  description = "EC2 instance ID — used by CI/CD to send SSM Run Commands"
}

output "elastic_ip" {
  value       = data.aws_eip.admin.public_ip
  description = "Elastic IP — UPDATE YOUR DNS A RECORD on host.co.in to this value"
}

output "private_ip" {
  value       = aws_instance.admin.private_ip
  description = "Private IP — used for internal VPC communication"
}