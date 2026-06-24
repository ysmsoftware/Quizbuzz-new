# LIVE CONTEST MODULE — AUTO SCALING GROUP
#
# This is the actual horizontally-scaling fleet of quiz backend instances.
# Each instance runs ONLY backend + worker containers (no Redis, no
# frontend, no nginx — see userdata.sh.tpl for why). They live in private
# subnets, register into the ALB's quiz-tg, and never get a public IP.

# ─────────────────────────────────────────────────────────────────────────────
# IAM ROLE FOR QUIZ EC2s
# Mirrors the admin instance's IAM role (SSM read, CloudWatch logs, S3
# access) but as its own dedicated role — kept separate from the admin
# role so permissions can be tuned independently later if needed (e.g.
# quiz instances never need to write to S3, only read certificate
# templates, whereas the worker on the admin instance writes generated
# certificates TO S3).
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_iam_role" "quiz_ec2" {
  name        = "quizbuzz-quiz-ec2-role"
  description = "Allows quiz EC2 instances to read SSM secrets, write CloudWatch logs"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "quiz_ssm_read" {
  role       = aws_iam_role.quiz_ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess"
}

resource "aws_iam_role_policy_attachment" "quiz_ssm_core" {
  role       = aws_iam_role.quiz_ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "quiz_cloudwatch_logs" {
  name = "quizbuzz-quiz-cloudwatch-logs"
  role = aws_iam_role.quiz_ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams",
          "logs:PutRetentionPolicy"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/quizbuzz/*"
      },
      {
        # PutRetentionPolicy also requires a wildcard on log-group ARN
        # without a trailing :* — AWS requires BOTH forms in some SDK versions.
        Effect = "Allow"
        Action = ["logs:PutRetentionPolicy"]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/quizbuzz/*:*"
      }
    ]
  })
}

# Quiz instances read certificate templates / write generated certs to S3
# (certificate generation runs on the worker, which lives on EVERY quiz
# EC2 during live mode for higher throughput — see DEPLOYMENT_PLAN.md
# Docker Compose section: live-mode workers run at concurrency 20 vs 5).
resource "aws_iam_role_policy" "quiz_s3_access" {
  name = "quizbuzz-quiz-s3-access"
  role = aws_iam_role.quiz_ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ]
      Resource = [
        "arn:aws:s3:::${var.s3_bucket}",
        "arn:aws:s3:::${var.s3_bucket}/*"
      ]
    }]
  })
}

resource "aws_iam_instance_profile" "quiz_ec2" {
  name = "quizbuzz-quiz-ec2-profile"
  role = aws_iam_role.quiz_ec2.name
}

# ─────────────────────────────────────────────────────────────────────────────
# AMI — same source as admin_instance module: latest Amazon Linux 2023.
# Kept as its own data lookup (not passed in as a variable) so this
# module is self-contained and always picks up the latest patched image
# independently, exactly mirroring the admin_instance module's pattern.
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
# LAUNCH TEMPLATE — the blueprint every ASG-created instance follows
#
# user_data here uses templatefile() the same way admin_instance/main.tf
# does: Terraform variables (${redis_host}, ${aws_region}, etc.) are
# substituted BEFORE the script reaches the EC2. Shell variables inside
# the script ($INSTANCE_ID, secrets pulled from SSM at boot) are resolved
# at runtime on the instance itself — see userdata.sh.tpl for the same
# single-quoted-heredoc nginx lesson applied to its docker-compose write.
#
# DEPENDENCY NOTE: this references aws_elasticache_replication_group.redis
# (defined in elasticache.tf, same module). Terraform resolves resource
# dependencies via the reference graph, not file order, so this is safe —
# Terraform will always create/read the Redis replication group's endpoint
# before rendering this userdata.
# ─────────────────────────────────────────────────────────────────────────────
data "cloudinit_config" "quiz_config" {
  gzip          = true
  base64_encode = true

  part {
    content_type = "text/x-shellscript"
    content = templatefile("${path.module}/userdata.sh.tpl", {
      aws_region = var.aws_region
      s3_bucket  = var.s3_bucket
      github_org = var.github_org
      domain     = var.domain
      redis_host = aws_elasticache_replication_group.redis.primary_endpoint_address
    })
  }
}

resource "aws_launch_template" "quiz" {
  name_prefix   = "quizbuzz-quiz-"
  image_id      = data.aws_ami.amazon_linux_2023.id
  instance_type = var.instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.quiz_ec2.name
  }

  # No public IP — quiz EC2s are only ever reached via the ALB.
  # Outbound internet (GHCR pulls, AWS API calls) goes through the NAT
  # Gateway in nat.tf via the quiz_private subnets' route table.
  network_interfaces {
    security_groups             = [var.ec2_sg_id]
    associate_public_ip_address = false
  }

  # IMDSv2 enforced — same reasoning as admin_instance module: Amazon
  # Linux 2023 requires the token-based metadata flow, and hop_limit = 2
  # allows the Docker containers (one network hop from the host) to also
  # reach instance metadata if ever needed.
  metadata_options {
    http_tokens                 = "required"
    http_endpoint               = "enabled"
    http_put_response_hop_limit = 2
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = 30
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  user_data = data.cloudinit_config.quiz_config.rendered

  tag_specifications {
    resource_type = "instance"
    tags          = { Name = "quizbuzz-quiz", Role = "quiz", Mode = "live" }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# AUTO SCALING GROUP
#
# min_size/max_size/desired_capacity all come from the root module, which
# calculates desired_capacity from expected_participants (1 instance per
# ~1000 users, capped at max_size). See environments/prod/main.tf locals.
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_autoscaling_group" "quiz" {
  name                = "quizbuzz-quiz-asg"
  vpc_zone_identifier = var.quiz_private_subnets
  target_group_arns   = [aws_lb_target_group.quiz.arn]

  min_size         = var.min_size
  max_size         = var.max_size
  desired_capacity = var.desired_capacity

  # health_check_type = "ELB" means the ASG trusts the ALB's /health check
  # (not just "is the instance running") to decide if an instance is
  # healthy — an instance whose Docker containers crashed but the EC2
  # itself is still up will correctly be marked unhealthy and replaced.
  health_check_type         = "ELB"
  health_check_grace_period = 420

  launch_template {
    id      = aws_launch_template.quiz.id
    version = "$Latest"
  }

  # Rolling instance refresh: if you change the launch template (new AMI,
  # new userdata) while live_contest already exists, this replaces
  # instances one at a time while keeping 100% capacity healthy
  # throughout — never drops below full capacity mid-contest.
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 100
      instance_warmup        = 420
    }
  }

  # CRITICAL: ignore_changes on desired_capacity means Terraform will
  # NEVER override a manual or scaling-policy-driven capacity change on
  # subsequent applies. Combined with disable_scale_in below, this is
  # what guarantees instances are NEVER automatically removed during a
  # live contest — only scale-OUT happens automatically; scale-down is
  # always a deliberate human action via go-idle.sh (which destroys this
  # whole module) or manual desired_capacity changes outside Terraform.
  lifecycle {
    ignore_changes = [desired_capacity]
  }

  tag {
    key                 = "Name"
    value               = "quizbuzz-quiz-asg-instance"
    propagate_at_launch = true
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# SCALING POLICY — target tracking on CPU, scale-OUT only
#
# disable_scale_in = true is the single most important line in this file.
# Without it, AWS's default target-tracking behavior would also scale IN
# (terminate instances) when CPU drops below target — which would mean
# AWS deciding to kill a quiz instance mid-contest the moment load dips,
# potentially dropping hundreds of active WebSocket connections and
# losing in-flight (not-yet-Redis-persisted) answer submissions.
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_autoscaling_policy" "cpu_scale_out" {
  name                   = "quizbuzz-cpu-scale-out"
  autoscaling_group_name = aws_autoscaling_group.quiz.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value     = 60.0
    disable_scale_in = true
  }
}

output "asg_name" {
  value       = aws_autoscaling_group.quiz.name
  description = "ASG name — used by go-live.sh to poll instance health and by CloudWatch alarms"
}

output "launch_template_id" {
  value       = aws_launch_template.quiz.id
  description = "Launch template ID — useful for manually triggering an instance refresh if userdata changes mid-contest"
}
