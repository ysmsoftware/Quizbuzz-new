# LIVE CONTEST MODULE — APPLICATION LOAD BALANCER
#
# Public-facing entry point during live mode (per the simplified, manual-DNS
# approach: this ALB IS the public internet-facing resource — you will
# manually update host.co.in's A record to point at this ALB's resolved IP
# when going live, and back to the admin EC2's Elastic IP when going idle.
# See go-live.sh / go-idle.sh for that manual step).

resource "aws_lb" "quiz" {
  name               = "quizbuzz-quiz-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_sg_id]
  subnets            = var.public_subnets

  # 1 hour — WebSocket connections must be allowed to stay open for the
  # full duration of a quiz without the ALB forcibly closing them as
  # "idle". Socket.IO's own heartbeat (WS_HEARTBEAT_INTERVAL=15000, i.e.
  # 15s, per your Config schema) keeps the connection active well under
  # this ceiling regardless.
  idle_timeout = 3600

  tags = { Name = "quizbuzz-quiz-alb" }
}

# ─────────────────────────────────────────────────────────────────────────────
# TARGET GROUPS
#
# BOTH target groups use port 3005 — this is your real backend port
# (Express + Socket.IO), confirmed against your actual docker-compose and
# security group setup. The original deployment plan draft used port 3000
# for target groups, which was based on an earlier port convention before
# your actual containers were built; 3005 is correct for this codebase.
# ─────────────────────────────────────────────────────────────────────────────

# admin-tg: routes to the existing admin EC2 (t2.small). Handles anything
# that ISN'T live quiz traffic — admin dashboard, registration, payments,
# results pages, certificate downloads, Next.js frontend SSR.
resource "aws_lb_target_group" "admin" {
  name     = "quizbuzz-admin-tg"
  port     = 3005
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    matcher             = "200"
  }

  tags = { Name = "quizbuzz-admin-tg" }
}

# quiz-tg: routes to the ASG fleet of quiz EC2s. Handles WebSocket
# connections and live-quiz API calls (join, submit, answer).
resource "aws_lb_target_group" "quiz" {
  name     = "quizbuzz-quiz-tg"
  port     = 3005
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  # 5 minutes — when an instance is deregistered (scale-in via go-idle.sh,
  # or a failed health check triggering ASG replacement), the ALB keeps
  # routing already-connected sessions to it for up to this long instead
  # of cutting them off immediately, giving in-progress quiz sessions a
  # chance to finish their current request/reconnect cycle gracefully.
  deregistration_delay = 300

  # Sticky sessions are NON-NEGOTIABLE for this target group: a
  # participant's Socket.IO connection and in-memory reconnect state
  # (QuizSession) must consistently land on the same backend instance.
  # Without this, a participant could be routed to a different instance
  # on reconnect than the one tracking their socket session, breaking
  # the reconnect-resume-at-correct-question flow.
  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400 # 1 day — longer than any single quiz duration
    enabled         = true
  }

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 15 # checked more frequently than admin-tg — faster detection during high-stakes live traffic
    matcher             = "200"
  }

  tags = { Name = "quizbuzz-quiz-tg" }
}

# Registers the EXISTING admin EC2 (created by the admin_instance module,
# already running before live_contest is ever applied) into admin-tg.
# This is what makes "everything except quiz traffic" reachable through
# the ALB during live mode, without needing a second admin instance.
resource "aws_lb_target_group_attachment" "admin_ec2" {
  target_group_arn = aws_lb_target_group.admin.arn
  target_id        = var.admin_instance_id
  port             = 3005
}

# ─────────────────────────────────────────────────────────────────────────────
# LISTENER — HTTP only for now
#
# WHY HTTP, NOT HTTPS, ON THE ALB ITSELF:
# An HTTPS listener requires an ACM certificate. Since DNS for this ALB is
# being handled manually (per your decision to keep things simple and not
# build the internal-proxy or NLB approach), the ALB does not yet have a
# stable hostname that ACM's DNS validation could automatically verify
# against. Adding HTTPS here is a deliberate next step, not skipped by
# accident — flagged clearly so it isn't forgotten:
#
#   TODO before first real production live-mode test with real user data:
#   1. Request an ACM certificate for quiz.ysminfosolution.com
#      (DNS validation requires a CNAME record at host.co.in — one-time
#      setup, the cert auto-renews afterward without re-validation as
#      long as that CNAME stays in place)
#   2. Add an aws_lb_listener "https" block on port 443 referencing the
#      cert's ARN, move the listener rules below onto it
#   3. Keep this HTTP listener only as a redirect-to-HTTPS rule, or
#      remove it entirely once HTTPS is confirmed working
#
# Running real contests over plain HTTP would mean OTP codes, JWTs, and
# session cookies all travel unencrypted between users and the ALB — only
# acceptable for initial connectivity testing, never for production use.
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.quiz.arn
  port              = 80
  protocol          = "HTTP"

  # Default: anything not matched by a more specific rule below goes to
  # the admin target group (dashboard, registration, etc.)
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.admin.arn
  }
}

# Rule 1: WebSocket connections (Socket.IO handshake + upgrade) → quiz fleet
resource "aws_lb_listener_rule" "websocket" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  condition {
    path_pattern { values = ["/socket.io/*"] }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.quiz.arn
  }
}

# Rule 2: Quiz-specific REST endpoints (join, submit, answer) → quiz fleet
# These paths must match your actual backend route prefixes exactly —
# verify against your contest/quiz module routes before first live test.
resource "aws_lb_listener_rule" "quiz_api" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 20

  condition {
    path_pattern {
      values = [
        "/api/v1/quiz/*",
        "/api/v1/contests/*/join",
        "/api/v1/contests/*/submit",
      ]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.quiz.arn
  }
}

# No explicit "everything else → admin" rule needed: the listener's
# default_action above already handles that as the catch-all.

output "alb_dns_name" {
  value       = aws_lb.quiz.dns_name
  description = "ALB's DNS name — resolve this to an IP (e.g. via dig) for the manual host.co.in A record update in go-live.sh"
}

output "alb_zone_id" {
  value       = aws_lb.quiz.zone_id
  description = "ALB's Route53 hosted zone ID — kept for future use if/when DNS migrates to NS-delegated Route53 (not used in the current manual-DNS approach)"
}

output "alb_arn" {
  value       = aws_lb.quiz.arn
  description = "ALB ARN — useful for CloudWatch alarms and manual AWS CLI health checks"
}

output "admin_tg_arn" {
  value       = aws_lb_target_group.admin.arn
  description = "Admin target group ARN"
}

output "quiz_tg_arn" {
  value       = aws_lb_target_group.quiz.arn
  description = "Quiz target group ARN — used by go-live.sh to poll target health before declaring the system ready"
}
