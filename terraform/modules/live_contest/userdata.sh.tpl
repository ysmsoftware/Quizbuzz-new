#!/bin/bash
set -euo pipefail
exec > >(tee /var/log/user-data.log | logger -t user-data) 2>&1

echo "=== QuizBuzz QUIZ EC2 Boot Script Starting ==="
echo "Time: $(date)"

# ─────────────────────────────────────────────────────────────────────────────
# WHAT THIS SCRIPT DELIBERATELY DOES NOT DO, COMPARED TO THE ADMIN INSTANCE:
#
#   - NO Redis container: REDIS_HOST points at the ElastiCache replication
#     group's primary endpoint (passed in via Terraform templatefile()),
#     shared across the entire quiz fleet. A local Redis here would mean
#     each instance has its own isolated session state — breaking
#     reconnect-to-a-different-instance and pub/sub broadcast entirely.
#
#   - NO frontend container: per DEPLOYMENT_PLAN.md, the Next.js frontend
#     stays on the admin EC2 only, both in idle and live mode. Quiz EC2s
#     are backend + worker only — pure compute for WebSocket/API traffic.
#     The ALB's admin-tg routes frontend requests to the admin instance
#     regardless of which "mode" the system is in.
#
#   - NO nginx, NO certbot: the ALB terminates the public-facing
#     connection (HTTP for now — see main.tf's TODO on adding HTTPS) and
#     forwards plain HTTP to this instance's port 3005 directly. Running
#     nginx here would be a redundant extra hop with no benefit, since
#     there's no SSL cert to manage at this layer and no second backend
#     port to route between (only the backend itself listens here).
#
#   - HIGHER queue/connection limits: this instance type (t3.medium) is
#     dedicated entirely to quiz traffic, unlike the admin t2.small which
#     shares capacity with the dashboard, registration, and webhooks.
#     QUEUE_CONCURRENCY and WS_MAX_CONNECTIONS_PER_INSTANCE are raised to
#     match the Docker Compose "Quiz Instances — Live Mode" values from
#     DEPLOYMENT_PLAN.md.
# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────
# 1. INSTALL DOCKER + DOCKER COMPOSE
# ─────────────────────────────────────────────────────────────────────────────
echo "--- Installing Docker ---"
yum update -y
yum install -y docker

systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user

echo "--- Installing SSM Agent ---"
yum install -y amazon-ssm-agent
systemctl enable amazon-ssm-agent
systemctl start amazon-ssm-agent

echo "--- Installing Docker Compose v2 ---"
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
docker compose version

echo "--- Installing CloudWatch Agent ---"
yum install -y amazon-cloudwatch-agent

# ─────────────────────────────────────────────────────────────────────────────
# 2. GET INSTANCE ID USING IMDSv2 — identical pattern to admin_instance,
# kept consistent across both modules deliberately.
# ─────────────────────────────────────────────────────────────────────────────
echo "--- Getting instance metadata (IMDSv2) ---"
IMDS_TOKEN=$(curl -s -X PUT \
  "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

INSTANCE_ID=$(curl -s \
  -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" \
  "http://169.254.169.254/latest/meta-data/instance-id")

if [[ ! "$INSTANCE_ID" =~ ^i- ]]; then
  echo "WARNING: Could not get instance ID (got: $INSTANCE_ID)"
  echo "Falling back to 'quiz-unknown' as instance ID for log streams"
  INSTANCE_ID="quiz-unknown"
fi

echo "Instance ID: $INSTANCE_ID"

# ─────────────────────────────────────────────────────────────────────────────
# 3. READ SECRETS FROM SSM PARAMETER STORE
# Same SSM paths as the admin instance — both pull from the SAME secret
# store (/quizbuzz/prod/*), since both modes share one database, one set
# of payment credentials, one set of JWT secrets, etc. Only REDIS_HOST
# differs structurally (passed via Terraform, not SSM, since it's an
# ElastiCache endpoint that only exists while this module is applied).
# ─────────────────────────────────────────────────────────────────────────────
echo "--- Reading secrets from SSM ---"

get_ssm() {
  local name="$1"
  local result
  result=$(aws ssm get-parameter \
    --name "$name" \
    --with-decryption \
    --query Parameter.Value \
    --output text \
    --region "${aws_region}" 2>&1)

  if [ $? -ne 0 ]; then
    echo "ERROR: Failed to read SSM param: $name"
    echo "$result"
    exit 1
  fi
  echo "$result"
}

get_ssm_optional() {
  local name="$1"
  local result
  result=$(aws ssm get-parameter \
    --name "$name" \
    --with-decryption \
    --query Parameter.Value \
    --output text \
    --region "${aws_region}" 2>/dev/null) || true
  echo "$result"
}

DATABASE_URL=$(get_ssm "/quizbuzz/prod/DATABASE_URL")
REDIS_PASSWORD=$(get_ssm_optional "/quizbuzz/prod/ELASTICACHE_AUTH_TOKEN")
JWT_ACCESS_SECRET=$(get_ssm "/quizbuzz/prod/JWT_ACCESS_SECRET")
JWT_REFRESH_SECRET=$(get_ssm "/quizbuzz/prod/JWT_REFRESH_SECRET")
JWT_CONTACT_SECRET=$(get_ssm "/quizbuzz/prod/JWT_CONTACT_SECRET")
OTP_SECRET=$(get_ssm "/quizbuzz/prod/OTP_SECRET")
RAZORPAY_KEY_ID=$(get_ssm "/quizbuzz/prod/RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET=$(get_ssm "/quizbuzz/prod/RAZORPAY_KEY_SECRET")
RAZORPAY_WEBHOOK_SECRET=$(get_ssm "/quizbuzz/prod/RAZORPAY_WEBHOOK_SECRET")
SMTP_USER=$(get_ssm "/quizbuzz/prod/SMTP_USER")
SMTP_PASS=$(get_ssm "/quizbuzz/prod/SMTP_PASS")
AISENSY_API_KEY=$(get_ssm "/quizbuzz/prod/AISENSY_API_KEY")
GHCR_TOKEN=$(get_ssm "/quizbuzz/prod/GHCR_TOKEN")
IMAGE_TAG=$(get_ssm "/quizbuzz/prod/image-tag")

POSTHOG_API_KEY=$(get_ssm "/quizbuzz/prod/POSTHOG_API_KEY")
POSTHOG_HOST=$(get_ssm_optional "/quizbuzz/prod/POSTHOG_HOST")
SENTRY_DSN=$(get_ssm_optional "/quizbuzz/prod/SENTRY_DSN")

if [ -z "$POSTHOG_HOST" ]; then
  POSTHOG_HOST="https://us.i.posthog.com"
fi

echo "Image tag: $IMAGE_TAG"

# NOTE on REDIS_PASSWORD / ELASTICACHE_AUTH_TOKEN:
# The current elasticache.tf does NOT set an auth_token (Redis AUTH) on
# the replication group — it relies entirely on the security group
# (port 6379 only reachable from ec2_sg_id) for access control, matching
# how your idle-mode Redis container itself still sets a password via
# REDIS_PASSWORD from SSM. If ELASTICACHE_AUTH_TOKEN doesn't exist in SSM,
# get_ssm_optional returns empty — meaning the .env's REDIS_PASSWORD will
# be blank, fine since ElastiCache won't be expecting AUTH in that case.
# Decide and align this for production: either add auth_token to the
# replication group in elasticache.tf AND create this SSM param, or
# explicitly accept SG-only protection. Flagging clearly rather than
# silently picking one.

# ─────────────────────────────────────────────────────────────────────────────
# 4. WRITE /app/.env
#
# CHANGES VS ADMIN INSTANCE .env:
#   - REDIS_HOST = ElastiCache endpoint (Terraform variable), not "redis"
#   - WS_MAX_CONNECTIONS_PER_INSTANCE = 1000 (vs 200 on admin t2.small)
#   - QUEUE_CONCURRENCY = 20 (vs 5)
#   - WORKER_INSTANCES = 4 (vs 2)
#   These three match DEPLOYMENT_PLAN.md's "Quiz Instances — Live Mode"
#   Docker Compose block exactly.
# ─────────────────────────────────────────────────────────────────────────────
echo "--- Writing /app/.env ---"
mkdir -p /app

cat > /app/.env << EOF
# ── APP ──────────────────────────────────────────────────────────────────────
NODE_ENV=production
APP_NAME=QuizBuzz
PORT=3005
BASE_URL=https://${domain}/api
DOMAIN=https://${domain}
FRONTEND_URL=https://${domain}
INSTANCE_ID=$INSTANCE_ID
INSTANCE_COUNT=1

# ── DATABASE ─────────────────────────────────────────────────────────────────
DATABASE_URL=$DATABASE_URL
DB_POOL_MIN=2
DB_POOL_MAX=5
DB_QUERY_TIMEOUT=5000

# ── REDIS (ElastiCache — shared across the entire quiz fleet) ───────────────
REDIS_HOST=${redis_host}
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_DB=0
REDIS_MAX_RETRIES=5
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
REDIS_CLUSTER_ENABLED=false
REDIS_CLUSTER_NODES=

# ── REDIS TTLs ────────────────────────────────────────────────────────────────
QUIZ_SESSION_TTL=7200
HEARTBEAT_TTL=30
SOCKET_TOKEN_TTL=7200
OTP_TTL=300
IDEMPOTENCY_TTL=86400

# ── WEBSOCKET (live-mode capacity — dedicated t3.mediums) ────────────────────
WS_NAMESPACE=/quiz
WS_PATH=/socket.io
WS_HEARTBEAT_INTERVAL=15000
WS_CONNECTION_TIMEOUT=30000
WS_MAX_CONNECTIONS_PER_INSTANCE=1000
WS_RECONNECT_ATTEMPTS=5
WS_RECONNECT_DELAY=2000

# ── AUTH ──────────────────────────────────────────────────────────────────────
JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_CONTACT_SECRET=$JWT_CONTACT_SECRET
JWT_ACCESS_TTL=1800
JWT_REFRESH_TTL=604800
JWT_CONTACT_TTL=900

COOKIE_DOMAIN=.ysminfosolution.com
COOKIE_SECURE=true
COOKIE_SAME_SITE=none

# ── OTP ───────────────────────────────────────────────────────────────────────
OTP_LENGTH=6
OTP_MAX_ATTEMPTS=5
OTP_RATE_LIMIT=5
OTP_SECRET=$OTP_SECRET

# ── RATE LIMITING ─────────────────────────────────────────────────────────────
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
RATE_LIMIT_LOGIN=10
RATE_LIMIT_REGISTER=5
RATE_LIMIT_OTP=5

# ── QUEUES (live-mode concurrency) ───────────────────────────────────────────
QUEUE_REDIS_DB=1
QUEUE_PREFIX=quizbuzz
QUEUE_CONCURRENCY=20
QUEUE_RETRY_ATTEMPTS=5
QUEUE_BACKOFF_TYPE=exponential
QUEUE_BACKOFF_DELAY=5000
WORKER_INSTANCES=4

# ── PAYMENT ───────────────────────────────────────────────────────────────────
RAZORPAY_KEY_ID=$RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET=$RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET=$RAZORPAY_WEBHOOK_SECRET
PAYMENT_CURRENCY=INR

# ── MESSAGING ─────────────────────────────────────────────────────────────────
SMTP_HOST=mail.ysminfosolution.com
SMTP_PORT=465
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
EMAIL_FROM=support@ysminfosolution.com

AISENSY_API_URL=https://backend.aisensy.com/campaign/t1/api/v2
AISENSY_API_KEY=$AISENSY_API_KEY
AISENSY_SENDER_ID=QuizBuzz

# ── FEATURE FLAGS ─────────────────────────────────────────────────────────────
ENABLE_PROCTORING=false
ENABLE_ANALYTICS=true
ENABLE_CERTIFICATES=true
ENABLE_NOTIFICATIONS=true

# ── ANALYTICS ─────────────────────────────────────────────────────────────────
ANALYTICS_SNAPSHOT_INTERVAL=900
ANALYTICS_RETENTION_DAYS=30

# ── PUB/SUB ───────────────────────────────────────────────────────────────────
REDIS_PUBSUB_ENABLED=true
REDIS_PUBSUB_PREFIX=quizbuzz

# ── LIMITS ────────────────────────────────────────────────────────────────────
MAX_PARTICIPANTS_PER_CONTEST=10000
MAX_QUESTIONS_PER_CONTEST=200
MAX_CONCURRENT_CONTESTS=5

# ── SECURITY ──────────────────────────────────────────────────────────────────
BCRYPT_SALT_ROUNDS=10
CORS_ALLOWED_ORIGINS=https://${domain}
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,PATCH,OPTIONS
CORS_ALLOW_CREDENTIALS=true

# ── IDEMPOTENCY ───────────────────────────────────────────────────────────────
IDEMPOTENCY_ENABLED=true

# ── STORAGE (S3) ──────────────────────────────────────────────────────────────
STORAGE_PROVIDER=s3
S3_BUCKET=${s3_bucket}
S3_REGION=${aws_region}
S3_ACCESS_KEY=
S3_SECRET_KEY=

# ── PROCTORING ────────────────────────────────────────────────────────────────
PROCTORING_EVENT_THRESHOLD=5
PROCTORING_STRICT_MODE=false

# ── OBSERVABILITY ─────────────────────────────────────────────────────────────
HEALTHCHECK_ENABLED=true
METRICS_ENABLED=true
LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_DEBUG_LOGS=false
MOCK_PAYMENT=false

# ── TIMEOUTS ──────────────────────────────────────────────────────────────────
API_TIMEOUT=30000
DB_TIMEOUT=5000
REDIS_TIMEOUT=5000

# ── QUIZ CONTROL ──────────────────────────────────────────────────────────────
QUIZ_AUTO_SUBMIT=true
QUIZ_TIME_WARNING_1=600
QUIZ_TIME_WARNING_2=300
QUIZ_TIME_WARNING_3=60

# ── POSTHOG ANALYTICS ─────────────────────────────────────────────────────────
POSTHOG_API_KEY=$POSTHOG_API_KEY
POSTHOG_HOST=$POSTHOG_HOST

# ── SENTRY ────────────────────────────────────────────────────────────────────
SENTRY_DSN=$SENTRY_DSN
APP_VERSION=$IMAGE_TAG
EOF

echo ".env written."

# ─────────────────────────────────────────────────────────────────────────────
# 5. WRITE /app/docker-compose.yml
#
# DELIBERATELY MINIMAL vs admin instance: only backend + worker. No redis
# service block (ElastiCache is external), no frontend service block.
# Backend's port 3005 is exposed directly to the host — the ALB's quiz-tg
# health checks and traffic hit this instance's IP:3005 over the VPC's
# private network, no nginx layer in between.
# ─────────────────────────────────────────────────────────────────────────────
echo "--- Writing /app/docker-compose.yml ---"

cat > /app/docker-compose.yml << EOF
version: '3.8'

services:

  # ── BACKEND ────────────────────────────────────────────────────────────────
  backend:
    image: ghcr.io/${github_org}/quizbuzz-backend:$IMAGE_TAG
    container_name: quizbuzz_backend
    restart: unless-stopped
    env_file: /app/.env
    ports:
      - "3005:3005"
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
    logging:
      driver: awslogs
      options:
        awslogs-group: /quizbuzz/backend-live
        awslogs-region: ${aws_region}
        awslogs-stream: $INSTANCE_ID
        awslogs-create-group: "true"
    networks:
      - quiz
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3005/health"]
      interval: 15s
      timeout: 10s
      retries: 3
      start_period: 30s

  # ── WORKER ─────────────────────────────────────────────────────────────────
  worker:
    image: ghcr.io/${github_org}/quizbuzz-backend:$IMAGE_TAG
    container_name: quizbuzz_worker
    restart: unless-stopped
    env_file: /app/.env
    command: ["node", "dist/worker.js"]
    depends_on:
      backend:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
    logging:
      driver: awslogs
      options:
        awslogs-group: /quizbuzz/worker-live
        awslogs-region: ${aws_region}
        awslogs-stream: $INSTANCE_ID
        awslogs-create-group: "true"
    networks:
      - quiz

networks:
  quiz:
    driver: bridge
    ipam:
      config:
        - subnet: 172.30.0.0/24
EOF

echo "docker-compose.yml written."

# ─────────────────────────────────────────────────────────────────────────────
# 6. CREATE CLOUDWATCH LOG GROUPS (live-mode-specific groups, kept
# separate from the admin instance's /quizbuzz/backend etc. so live
# traffic logs don't interleave with idle-mode admin logs)
# ─────────────────────────────────────────────────────────────────────────────
echo "--- Creating CloudWatch log groups ---"
for log_group in /quizbuzz/backend-live /quizbuzz/worker-live; do
  aws logs create-log-group --log-group-name "$log_group" \
    --region "${aws_region}" 2>/dev/null || true
  # || true: PutRetentionPolicy fails if the IAM role doesn't yet have the
  # permission (race between instance boot and IAM policy propagation).
  # awslogs driver already auto-creates the group; retention is best-effort.
  aws logs put-retention-policy \
    --log-group-name "$log_group" \
    --retention-in-days 30 \
    --region "${aws_region}" || true
  echo "  $log_group configured"
done

# ─────────────────────────────────────────────────────────────────────────────
# 7. LOGIN TO GHCR, PULL IMAGES, START CONTAINERS
# ─────────────────────────────────────────────────────────────────────────────
echo "--- Logging into GHCR ---"
echo "$GHCR_TOKEN" | docker login ghcr.io -u "${github_org}" --password-stdin

echo "--- Pulling images ---"
docker compose -f /app/docker-compose.yml pull

echo "--- Starting containers ---"
docker compose -f /app/docker-compose.yml up -d

echo "--- Waiting 20s for containers to initialise ---"
sleep 20
docker compose -f /app/docker-compose.yml ps

# ─────────────────────────────────────────────────────────────────────────────
# 8. SYSTEMD — restart containers automatically if the instance reboots
# mid-contest (e.g. AWS underlying host maintenance event). Combined with
# the ASG's health checks, a reboot-and-recover here is preferable to the
# ASG simply terminating and replacing the instance, since it preserves
# any Docker layer cache and avoids a full re-pull + re-registration.
# ─────────────────────────────────────────────────────────────────────────────
cat > /etc/systemd/system/quizbuzz.service << 'SERVICE'
[Unit]
Description=QuizBuzz Quiz Instance Docker Compose
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/app
ExecStart=/usr/local/lib/docker/cli-plugins/docker-compose -f /app/docker-compose.yml up -d
ExecStop=/usr/local/lib/docker/cli-plugins/docker-compose -f /app/docker-compose.yml down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable quizbuzz.service

echo "=== Boot script complete: $(date) ==="
echo "Check containers: docker compose -f /app/docker-compose.yml ps"
echo "This instance has NO public IP — reachable only via the ALB's quiz-tg."
