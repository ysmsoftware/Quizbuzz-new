#!/bin/bash
set -euo pipefail
exec > >(tee /var/log/user-data.log | logger -t user-data) 2>&1

echo "=== QuizBuzz EC2 Boot Script Starting ==="
echo "Time: $(date)"

# ─────────────────────────────────────────────────────────────────────────────
# 1. INSTALL DOCKER + DOCKER COMPOSE
# ─────────────────────────────────────────────────────────────────────────────
echo "--- Installing Docker ---"
yum update -y
yum install -y docker git

systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user

echo "--- Installing Docker Compose v2 ---"
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
docker compose version

echo "--- Installing CloudWatch Agent ---"
yum install -y amazon-cloudwatch-agent

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

DATABASE_URL=$(get_ssm "/quizbuzz/prod/DATABASE_URL")
REDIS_PASSWORD=$(get_ssm "/quizbuzz/prod/REDIS_PASSWORD")
JWT_ACCESS_SECRET=$(get_ssm "/quizbuzz/prod/JWT_ACCESS_SECRET")
JWT_REFRESH_SECRET=$(get_ssm "/quizbuzz/prod/JWT_REFRESH_SECRET")
JWT_RESET_SECRET=$(get_ssm "/quizbuzz/prod/JWT_RESET_SECRET")
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

# EC2 instance ID — from AWS metadata service (always available, no SSM needed)
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)

echo "Instance: $INSTANCE_ID  |  Image tag: $IMAGE_TAG"

# ─────────────────────────────────────────────────────────────────────────────
# 3. WRITE /app/.env
#
# This file contains every variable that your Zod config schema validates.
# Source of truth for what goes here: backend/src/config/index.ts
#
# HOW VALUES ARE CATEGORISED:
#   - Secrets (from SSM above): DB URL, JWT secrets, payment keys, SMTP, etc.
#   - Non-secret config: ports, timeouts, feature flags — hardcoded here.
#     To change a non-secret value, update this script and re-deploy.
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
# DATABASE_URL comes from SSM — points to RDS PostgreSQL
DATABASE_URL=$DATABASE_URL
DB_POOLMIN=2
DB_POOLMAX=5
DB_QUERY_TIMEOUT=5000

# ── REDIS ─────────────────────────────────────────────────────────────────────
# In idle mode: Redis runs as a container on this EC2 (service name = "redis")
# In live mode: REDIS_HOST will be updated to point to ElastiCache endpoint
REDIS_HOST=redis
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

# ── WEBSOCKET ─────────────────────────────────────────────────────────────────
WS_NAMESPACE=/quiz
WS_PATH=/socket.io
WS_HEARTBEAT_INTERVAL=15000
WS_CONNECTION_TIMEOUT=30000
# Conservative for t2.small — increase to 1000 on c6i.large in live mode
WS_MAX_CONNECTIONS_PER_INSTANCE=200
WS_RECONNECT_ATTEMPTS=5
WS_RECONNECT_DELAY=2000

# ── AUTH ──────────────────────────────────────────────────────────────────────
JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_RESET_SECRET=$JWT_RESET_SECRET
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

# ── QUEUES ────────────────────────────────────────────────────────────────────
QUEUE_REDIS_DB=1
QUEUE_PREFIX=quizbuzz
QUEUE_CONCURRENCY=5
QUEUE_RETRY_ATTEMPTS=5
QUEUE_BACKOFF_TYPE=exponential
QUEUE_BACKOFF_DELAY=5000
WORKER_INSTANCES=2

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
# S3_ACCESS_KEY and S3_SECRET_KEY are intentionally BLANK.
# The EC2 IAM role grants S3 access — no explicit keys needed.
# Passing blank keys is safe; the AWS SDK will use the role instead.
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
EOF

echo ".env written."

echo "--- Writing /app/docker-compose.yml ---"

cat > /app/docker-compose.yml << 'COMPOSE_EOF'
version: '3.8'
x-logging: &default-logging
  driver: awslogs
  options:
    awslogs-region: AWS_REGION_PLACEHOLDER
    awslogs-create-group: "true"
services:
  redis:
    image: redis:7-alpine
    container_name: quizbuzz_redis
    restart: unless-stopped
    command:
      - redis-server
      - --requirepass
      - REDIS_PASSWORD_PLACEHOLDER
      - --maxmemory
      - 256mb
      - --maxmemory-policy
      - allkeys-lru
      - --save
      - ""
      - --appendonly
      - no
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "REDIS_PASSWORD_PLACEHOLDER", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    networks:
      - internal
  backend:
    image: ghcr.io/GITHUB_ORG_PLACEHOLDER/quizbuzz-backend:IMAGE_TAG_PLACEHOLDER
    container_name: quizbuzz_backend
    restart: unless-stopped
    env_file: /app/.env
    ports:
      - "3005:3005"
    depends_on:
      redis:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 800M
    logging:
      <<: *default-logging
      options:
        awslogs-group: /quizbuzz/backend
        awslogs-region: AWS_REGION_PLACEHOLDER
        awslogs-stream: INSTANCE_ID_PLACEHOLDER
        awslogs-create-group: "true"
    networks:
      - internal
      - external
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3005/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
  worker:
    image: ghcr.io/GITHUB_ORG_PLACEHOLDER/quizbuzz-backend:IMAGE_TAG_PLACEHOLDER
    container_name: quizbuzz_worker
    restart: unless-stopped
    env_file: /app/.env
    command: ["node", "dist/worker.js"]
    depends_on:
      redis:
        condition: service_healthy
      backend:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: '0.6'
          memory: 500M
    logging:
      <<: *default-logging
      options:
        awslogs-group: /quizbuzz/worker
        awslogs-region: AWS_REGION_PLACEHOLDER
        awslogs-stream: INSTANCE_ID_PLACEHOLDER
        awslogs-create-group: "true"
    networks:
      - internal
  frontend:
    image: ghcr.io/GITHUB_ORG_PLACEHOLDER/quizbuzz-frontend:IMAGE_TAG_PLACEHOLDER
    container_name: quizbuzz_frontend
    restart: unless-stopped
    environment:
      NODE_ENV: production
    ports:
      - "3000:3000"
    depends_on:
      backend:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: '0.6'
          memory: 500M
    logging:
      <<: *default-logging
      options:
        awslogs-group: /quizbuzz/frontend
        awslogs-region: AWS_REGION_PLACEHOLDER
        awslogs-stream: INSTANCE_ID_PLACEHOLDER
        awslogs-create-group: "true"
    networks:
      - external
networks:
  internal:
    driver: bridge
  external:
    driver: bridge
COMPOSE_EOF

# Substitute all PLACEHOLDER values with real values using sed.
# We do this AFTER the heredoc because single-quoted heredocs don't expand vars.
sed -i "s|GITHUB_ORG_PLACEHOLDER|${github_org}|g"   /app/docker-compose.yml
sed -i "s|IMAGE_TAG_PLACEHOLDER|$IMAGE_TAG|g"        /app/docker-compose.yml
sed -i "s|AWS_REGION_PLACEHOLDER|${aws_region}|g"   /app/docker-compose.yml
sed -i "s|INSTANCE_ID_PLACEHOLDER|$INSTANCE_ID|g"   /app/docker-compose.yml
sed -i "s|REDIS_PASSWORD_PLACEHOLDER|$REDIS_PASSWORD|g" /app/docker-compose.yml

echo "docker-compose.yml written."

# ─────────────────────────────────────────────────────────────────────────────
# 5. CREATE CLOUDWATCH LOG GROUPS (with 30-day retention)
# ─────────────────────────────────────────────────────────────────────────────
echo "--- Creating CloudWatch log groups ---"
for log_group in /quizbuzz/backend /quizbuzz/worker /quizbuzz/frontend; do
  aws logs create-log-group --log-group-name "$log_group" \
    --region "${aws_region}" 2>/dev/null || true
  aws logs put-retention-policy \
    --log-group-name "$log_group" \
    --retention-in-days 30 \
    --region "${aws_region}"
  echo "  $log_group (30 days)"
done

# ─────────────────────────────────────────────────────────────────────────────
# 6. LOGIN TO GHCR AND PULL + START CONTAINERS
#
# GHCR_TOKEN is a GitHub PAT with read:packages scope.
# The username for docker login must match github_org exactly.
# ─────────────────────────────────────────────────────────────────────────────
echo "--- Logging into GHCR ---"
echo "$GHCR_TOKEN" | docker login ghcr.io -u "${github_org}" --password-stdin

echo "--- Pulling images ---"
docker compose -f /app/docker-compose.yml pull

echo "--- Starting containers ---"
docker compose -f /app/docker-compose.yml up -d

sleep 15
docker compose -f /app/docker-compose.yml ps

# ─────────────────────────────────────────────────────────────────────────────
# 7. SYSTEMD SERVICE — auto-restart containers on EC2 reboot
# Without this, a reboot (AWS maintenance, OS patch) stops all containers.
# ─────────────────────────────────────────────────────────────────────────────
cat > /etc/systemd/system/quizbuzz.service << 'SERVICE'
[Unit]
Description=QuizBuzz Docker Compose
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/app
ExecStart=/usr/local/lib/docker/cli-plugins/docker-compose up -d
ExecStop=/usr/local/lib/docker/cli-plugins/docker-compose down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable quizbuzz.service

echo "=== Boot script complete: $(date) ==="
echo "Run: docker compose -f /app/docker-compose.yml ps"
