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

echo "--- Installing Nginx ---"
if command -v amazon-linux-extras >/dev/null 2>&1; then
  amazon-linux-extras install nginx1 -y
else
  yum install -y nginx
fi

echo "--- Installing Certbot ---"
python3 -m venv /opt/certbot/
/opt/certbot/bin/pip install --upgrade pip
/opt/certbot/bin/pip install certbot certbot-nginx
ln -sf /opt/certbot/bin/certbot /usr/bin/certbot


# ─────────────────────────────────────────────────────────────────────────────
# 2. GET INSTANCE ID USING IMDSv2
#
# WHY IMDSv2 AND NOT THE OLD curl http://169.254.169.254/... ?
# Amazon Linux 2023 enforces IMDSv2 by default. IMDSv1 (direct curl without
# a token) returns HTTP 401. The fix is a two-step process:
#   Step 1: Request a short-lived token from the metadata service
#   Step 2: Use that token in the header of the actual metadata request
#
# The token TTL is 21600 seconds (6 hours) — more than enough for boot.
# ─────────────────────────────────────────────────────────────────────────────
echo "--- Getting instance metadata (IMDSv2) ---"
IMDS_TOKEN=$(curl -s -X PUT \
  "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

INSTANCE_ID=$(curl -s \
  -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" \
  "http://169.254.169.254/latest/meta-data/instance-id")

# Validate — instance ID must start with "i-"
if [[ ! "$INSTANCE_ID" =~ ^i- ]]; then
  echo "WARNING: Could not get instance ID (got: $INSTANCE_ID)"
  echo "Falling back to 'admin' as instance ID for log streams"
  INSTANCE_ID="admin"
fi

echo "Instance ID: $INSTANCE_ID"

# ─────────────────────────────────────────────────────────────────────────────
# 3. READ ALL SECRETS FROM SSM PARAMETER STORE
#
# The EC2 IAM role (quizbuzz-admin-ec2-role) has AmazonSSMReadOnlyAccess.
# No AWS credentials needed — the role provides them automatically.
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

# get_ssm_optional: returns empty string instead of exiting if param is missing.
# Use for optional config like SENTRY_DSN that shouldn't block boot.
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
REDIS_PASSWORD=$(get_ssm "/quizbuzz/prod/REDIS_PASSWORD")
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

# ── Analytics & Observability (added: these are required by the Zod schema) ──
POSTHOG_API_KEY=$(get_ssm "/quizbuzz/prod/POSTHOG_API_KEY")
POSTHOG_HOST=$(get_ssm_optional "/quizbuzz/prod/POSTHOG_HOST")
SENTRY_DSN=$(get_ssm_optional "/quizbuzz/prod/SENTRY_DSN")

# Default POSTHOG_HOST if not in SSM
if [ -z "$POSTHOG_HOST" ]; then
  POSTHOG_HOST="https://us.i.posthog.com"
fi

echo "Image tag: $IMAGE_TAG"

# ─────────────────────────────────────────────────────────────────────────────
# 4. WRITE /app/.env
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

# ── REDIS ─────────────────────────────────────────────────────────────────────
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
WS_MAX_CONNECTIONS_PER_INSTANCE=200
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
# NETWORK FIX:
# Docker's default bridge networks use 172.17.x, 172.18.x, 172.19.x etc.
# When compose creates unnamed networks, it picks the next available subnet,
# which can conflict with the existing Docker bridge (172.17.0.0/16) or the
# default compose network. This causes the error:
#   "cannot program address 172.19.0.4/16 in sandbox interface because it
#    conflicts with existing route"
#
# Fix: explicitly assign non-overlapping subnets to both compose networks:
#   internal: 172.30.0.0/24  (backend <-> redis, backend <-> worker)
#   external: 172.31.0.0/24  (backend <-> frontend, public port exposure)
# These ranges (172.30.x, 172.31.x) are outside Docker's default allocation
# range and will not conflict.
#
# INSTANCE_ID IN COMPOSE:
# We write INSTANCE_ID directly into the compose file via the heredoc
# (not via sed placeholder) because sed breaks when the value contains
# special characters like < > / from an HTML 401 error. Since we now
# validate INSTANCE_ID above (must start with i-), this is safe.
# ─────────────────────────────────────────────────────────────────────────────
echo "--- Writing /app/docker-compose.yml ---"

# Write the compose file using a double-quoted heredoc so shell variables
# expand directly. REDIS_PASSWORD, IMAGE_TAG, INSTANCE_ID, github_org,
# aws_region are all safe to expand here — they've been validated above.
# Terraform template variables (${domain}, ${s3_bucket}, ${aws_region},
# ${github_org}) are substituted by templatefile() before this script runs.
cat > /app/docker-compose.yml << EOF
version: '3.8'

services:

  # ── REDIS ──────────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: quizbuzz_redis
    restart: unless-stopped
    command:
      - redis-server
      - --requirepass
      - "$REDIS_PASSWORD"
      - --maxmemory
      - 256mb
      - --maxmemory-policy
      - noeviction
      - --save
      - ""
      - --appendonly
      - "no"
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "$REDIS_PASSWORD", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    networks:
      - internal

  # ── BACKEND ────────────────────────────────────────────────────────────────
  backend:
    image: ghcr.io/${github_org}/quizbuzz-backend:$IMAGE_TAG
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
      driver: awslogs
      options:
        awslogs-group: /quizbuzz/backend
        awslogs-region: ${aws_region}
        awslogs-stream: $INSTANCE_ID
        awslogs-create-group: "true"
    networks:
      - internal
      - external
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3005/health"]
      interval: 30s
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
      driver: awslogs
      options:
        awslogs-group: /quizbuzz/worker
        awslogs-region: ${aws_region}
        awslogs-stream: $INSTANCE_ID
        awslogs-create-group: "true"
    networks:
      - internal

  # ── FRONTEND ───────────────────────────────────────────────────────────────
  frontend:
    image: ghcr.io/${github_org}/quizbuzz-frontend:$IMAGE_TAG
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
      driver: awslogs
      options:
        awslogs-group: /quizbuzz/frontend
        awslogs-region: ${aws_region}
        awslogs-stream: $INSTANCE_ID
        awslogs-create-group: "true"
    networks:
      - external

networks:
  internal:
    driver: bridge
    ipam:
      config:
        - subnet: 172.30.0.0/24
  external:
    driver: bridge
    ipam:
      config:
        - subnet: 172.31.0.0/24
EOF

echo "docker-compose.yml written."

# ─────────────────────────────────────────────────────────────────────────────
# 6. CREATE CLOUDWATCH LOG GROUPS
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
# 8. SYSTEMD — restart containers automatically after EC2 reboot
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
ExecStart=/usr/local/lib/docker/cli-plugins/docker-compose -f /app/docker-compose.yml up -d
ExecStop=/usr/local/lib/docker/cli-plugins/docker-compose -f /app/docker-compose.yml down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable quizbuzz.service

# ─────────────────────────────────────────────────────────────────────────────
# 9. NGINX CONFIGURATION
#
# IMPORTANT — WHY WE USE A DOUBLE-QUOTED HEREDOC HERE:
# The nginx config contains no shell variables that need runtime expansion.
# However, we use double-quotes ("NGINX_EOF") instead of single-quotes
# ('NGINX_EOF') because Terraform's templatefile() has already substituted
# ${domain} with the real domain name before this script runs on EC2.
# Single-quoted heredocs would write the literal string "${domain}" to
# the file, which nginx would reject.
#
# SSL STRATEGY:
# On first boot, nginx starts on HTTP only (port 80). Certbot is installed
# but NOT run automatically — you run it once manually after first deploy:
#   sudo certbot --nginx -d quiz.ysminfosolution.com
# Certbot will add the SSL block and a renewal cron automatically.
# On subsequent terraform destroy/apply cycles, the Let's Encrypt certs
# are already stored in /etc/letsencrypt (persisted on the EBS volume).
# If the EC2 is replaced (new instance), re-run certbot once.
# ─────────────────────────────────────────────────────────────────────────────
echo "--- Writing Nginx Configuration ---"
mkdir -p /etc/nginx/conf.d

# Remove the default nginx server block so it doesn't conflict
rm -f /etc/nginx/conf.d/default.conf

# NOTE: This heredoc is SINGLE-quoted ('NGINX_TEMPLATE') so NEITHER bash
# NOR Terraform's templatefile() touch its contents -- nginx's own $variables
# (http_upgrade, host, scheme, etc.) survive untouched. The literal string
# __DOMAIN__ is used as a placeholder and replaced with sed afterward.
# This avoids the double-escaping bug where \$ and unicode dashes got
# written literally into the config file.
cat > /etc/nginx/conf.d/quiz.conf << 'NGINX_TEMPLATE'
# Rate limit zone
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;

# WebSocket upgrade map
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

# HTTP-only server block.
# Certbot will extend this with an SSL redirect and add a 443 block
# the first time you run: certbot --nginx -d __DOMAIN__
server {
    listen 80;
    listen [::]:80;
    server_name __DOMAIN__;

    # Allow Let's Encrypt HTTP-01 challenge through
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Temporary: serve over HTTP until certbot runs.
    # After certbot, this block is replaced by a 301 redirect to HTTPS.

    # Frontend -- Next.js on port 3000
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection $connection_upgrade;
        proxy_set_header   Host       $host;
        proxy_set_header   X-Real-IP  $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffers      8 32k;
        proxy_buffer_size  64k;
    }

    # Backend API -- Express on port 3005
    location /api {
        proxy_pass         http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header   Host       $host;
        proxy_set_header   X-Real-IP  $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        limit_req          zone=api_limit burst=50 nodelay;
        proxy_read_timeout    60s;
        proxy_connect_timeout 60s;
    }

    # Socket.IO -- Backend on port 3005
    location /socket.io {
        proxy_pass         http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection $connection_upgrade;
        proxy_set_header   Host       $host;
        proxy_set_header   X-Real-IP  $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout  86400s;
        proxy_send_timeout  86400s;
        proxy_buffering     off;
    }
}
NGINX_TEMPLATE

# Substitute the real domain in place of the placeholder.
# templatefile() variable ${domain} was already resolved by Terraform
# BEFORE this script ever runs, so $domain here is a normal bash variable
# available in this script's environment via the templatefile() substitution
# done earlier in the file (see top-level ${domain} usage elsewhere).
sed -i "s/__DOMAIN__/${domain}/g" /etc/nginx/conf.d/quiz.conf

mkdir -p /var/www/certbot

# Validate config BEFORE starting -- fail loudly if broken instead of
# silently leaving nginx down
if ! nginx -t 2>&1; then
  echo "ERROR: nginx config is invalid. Dumping file for debugging:"
  cat /etc/nginx/conf.d/quiz.conf
  exit 1
fi

# Enable and start Nginx
systemctl enable nginx
systemctl restart nginx

echo "--- Nginx started on HTTP. Run certbot once to enable HTTPS: ---"
echo "    sudo certbot --nginx -d ${domain}"
echo "--- nginx -t output: ---"
nginx -t

echo "=== Boot script complete: $(date) ==="
echo "Check containers: docker compose -f /app/docker-compose.yml ps"

