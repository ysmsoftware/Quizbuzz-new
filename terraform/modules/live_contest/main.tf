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
#
# PORT CORRECTED FROM 3005 TO 80 — REAL BUG FOUND DURING FIRST LIVE TEST:
# This target group originally forwarded to port 3005 (the backend API
# port), but the comment above it always said it should also serve the
# Next.js frontend (port 3000). Those two facts contradicted each other.
#
# The admin EC2 already runs nginx (see modules/admin_instance and the
# live quiz.conf you configured), which does its OWN path-based routing:
#   /            -> proxy_pass to 127.0.0.1:3000 (Next.js frontend)
#   /api         -> proxy_pass to 127.0.0.1:3005 (Express backend)
#   /socket.io   -> proxy_pass to 127.0.0.1:3005 (Socket.IO)
# on port 80 (then 443 with certbot, in idle mode).
#
# Forwarding admin-tg directly to 3005 completely bypassed nginx, which
# meant: (a) the frontend was NEVER reachable through the ALB in live
# mode — only the backend API was, even for plain page loads, and
# (b) nginx's own routing logic (frontend vs backend split) was being
# skipped entirely for any traffic arriving via the ALB.
# The fix: point admin-tg at port 80, so nginx on the admin instance
# does the SAME frontend/backend split for ALB-routed traffic that it
# already does for direct-IP traffic in idle mode. This means nginx's
# config is now the single source of truth for admin-instance routing
# in BOTH modes — not duplicated or contradicted by ALB-level rules.

resource "aws_lb_target_group" "admin" {
  name_prefix      = "adm-"
  port             = 443
  protocol         = "HTTPS"
  vpc_id           = var.vpc_id

  # The admin EC2 runs nginx with a Let's Encrypt cert on port 443.
  # ALB sends HTTPS directly to nginx, which terminates SSL and routes
  # internally to frontend (:3000) or backend (:3005). This avoids the
  # redirect loop that happens when admin-tg forwards to port 80:
  # ALB(HTTPS) → nginx:80 → 301 HTTPS → ALB(HTTPS) → nginx:80 → ...
  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    matcher             = "200"
    protocol            = "HTTPS"
  }

  tags = { Name = "quizbuzz-admin-tg" }
  lifecycle {
    create_before_destroy = true
  }
}

# quiz-tg: routes to the ASG fleet of quiz EC2s. Handles WebSocket
# connections and live-quiz API calls (join, submit, answer).
resource "aws_lb_target_group" "quiz" {
  name_prefix     = "quiz-"
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
  lifecycle {
    create_before_destroy = true
  }
}



# Registers the EXISTING admin EC2 (created by the admin_instance module,
# already running before live_contest is ever applied) into admin-tg.
# This is what makes "everything except quiz traffic" reachable through
# the ALB during live mode, without needing a second admin instance.
#
# Port 80, not 3005 — matches the target group's corrected port above.
# This means the ALB's health check ("/health" on port 80) hits nginx,
# which proxies it through to the backend's actual /health endpoint on
# 3005. If nginx itself is down (not just the backend), this correctly
# reports unhealthy too — a more complete health signal than hitting
# 3005 directly, which would say "healthy" even if nginx had crashed and
# frontend traffic had no path to reach the instance at all.
resource "aws_lb_target_group_attachment" "admin_ec2" {
  target_group_arn = aws_lb_target_group.admin.arn
  target_id        = var.admin_instance_id
  port             = 443
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
    type             = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}
# HTTPS listener — actual traffic routing
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.quiz.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.admin.arn
  }
}

# Rule 1: WebSocket → quiz fleet (explicit for clarity/priority),
resource "aws_lb_listener_rule" "websocket" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  condition {
    path_pattern { values = ["/socket.io/*"] }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.quiz.arn
  }
}

# Rule 2: All API traffic → quiz fleet
# /api/* must go to quiz-tg (ASG instances), NOT admin-tg.
# admin-tg has only ONE target (the admin EC2). If that backend container
# goes down, admin-tg has no failover target and returns 502 for all API
# requests. The ASG quiz instances run the same backend image and can
# serve all API routes — they are stateless, reading from the same
# PostgreSQL + ElastiCache. Routing /api/* to quiz-tg gives us:
#   (a) real failover — if one instance is unhealthy, ALB picks another
#   (b) load distribution across the fleet for API requests
#   (c) admin-tg becomes frontend-only (nginx → Next.js on :3000)
#       which is its correct role — admin dashboard pages only
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 15

  condition {
    path_pattern { values = ["/api/*"] }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.quiz.arn
  }
}

# Rule 3: Frontend-only paths -> admin-tg (the ONLY Next.js runs)

resource "aws_lb_listener_rule" "frontend" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  condition {
    path_pattern {
      values = [
        "/",
        "/_next/*",
        "/favicon.ico",       
      ]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.admin.arn
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
