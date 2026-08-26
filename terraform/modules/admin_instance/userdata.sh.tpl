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

POSTHOG_API_KEY=$(get_ssm "/quizbuzz/prod/POSTHOG_API_KEY")
POSTHOG_HOST=$(get_ssm_optional "/quizbuzz/prod/POSTHOG_HOST")
SENTRY_DSN=$(get_ssm_optional "/quizbuzz/prod/SENTRY_DSN")
OPS_BASE_URL=$(get_ssm_optional "/quizbuzz/prod/OPS_BASE_URL")

if [ -z "$POSTHOG_HOST" ]; then
  POSTHOG_HOST="https://us.i.posthog.com"
fi

# Without this, getPlans() falls back to a static single "Free" plan
# instead of the real ops-configured plan catalog.
if [ -z "$OPS_BASE_URL" ]; then
  OPS_BASE_URL="https://ops.ysmquizbuzz.com"
fi

# EC2 instance ID via IMDSv2 — Amazon Linux 2023 enforces IMDSv2 by default,
# so a bare curl without a token returns HTTP 401. Fetch a short-lived token
# first, then use it in the header of the actual metadata request.
IMDS_TOKEN=$(curl -s -X PUT \
  "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

INSTANCE_ID=$(curl -s \
  -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" \
  "http://169.254.169.254/latest/meta-data/instance-id")

if [[ ! "$INSTANCE_ID" =~ ^i- ]]; then
  echo "WARNING: Could not get instance ID (got: $INSTANCE_ID)"
  echo "Falling back to 'admin' as instance ID for log streams"
  INSTANCE_ID="admin"
fi

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

# Ops app (billing portal / subscription plan catalog). Falls back to the
# hardcoded default above if not set in SSM — see OPS_BASE_URL just above.
OPS_BASE_URL=$OPS_BASE_URL

# Node.js heap — default is ~512MB which OOMs under load.
# t3.small has 2GB RAM; backend gets 800M container limit, we give Node
# 1.5GB to match the quiz instances (container limit is a soft ceiling,
# not a hard kill — the OS will OOM-kill before Docker's soft limit).
NODE_OPTIONS=--max-old-space-size=1536

# ── DATABASE ─────────────────────────────────────────────────────────────────
# DATABASE_URL comes from SSM — points to RDS PostgreSQL
DATABASE_URL=$DATABASE_URL
DB_POOL_MIN=2
DB_POOL_MAX=5
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
# Conservative for t2.small — increase to 1000 on t3.medium in live mode
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

COOKIE_DOMAIN=.ysmquizbuzz.com
COOKIE_SECURE=true
COOKIE_SAME_SITE=none

# ── OTP ───────────────────────────────────────────────────────────────────────
OTP_LENGTH=6
OTP_MAX_ATTEMPTS=10
OTP_RATE_LIMIT=6
OTP_SECRET=$OTP_SECRET

# ── RATE LIMITING ─────────────────────────────────────────────────────────────
RATE_LIMIT_WINDOW=600
RATE_LIMIT_MAX=100
RATE_LIMIT_LOGIN=10
RATE_LIMIT_REGISTER=10
RATE_LIMIT_OTP=10

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
EMAIL_FROM=support@ysminfosolution.com
SMTP_HOST=mail.ysminfosolution.com
SMTP_PORT=465
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS

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

# ── POSTHOG ANALYTICS ─────────────────────────────────────────────────────────
POSTHOG_API_KEY=$POSTHOG_API_KEY
POSTHOG_HOST=$POSTHOG_HOST

# ── SENTRY ────────────────────────────────────────────────────────────────────
SENTRY_DSN=$SENTRY_DSN
APP_VERSION=$IMAGE_TAG
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
      - noeviction
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
    --region "${aws_region}" || true
  echo "  $log_group configured"
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
# 7. NGINX CONFIGURATION
#
# SSL STRATEGY:
# Nginx must listen on port 443 HTTPS immediately on boot, so that the ALB
# target health checks succeed without causing a 502 Bad Gateway.
# To achieve this:
# 1. We check whether a REAL certbot-managed certificate already exists for
#    this domain (a renewal config in /etc/letsencrypt/renewal/ is the
#    signal certbot itself uses — its presence means a previous certbot run
#    on THIS EBS volume issued and is tracking a real cert).
# 2. If not, we generate a temporary self-signed fallback certificate so
#    nginx has something to bind :443 to immediately.
# 3. We configure Nginx with both port 80 (HTTP) and port 443 (HTTPS) enabled.
# 4. Further down (after nginx is serving the ACME HTTP-01 challenge path),
#    certbot runs AUTOMATICALLY — no manual step. See CERTBOT_MANAGED below:
#    this is what makes step 4 safe to run unconditionally on every boot,
#    including on a fresh instance replacement (e.g. an AMI refresh forcing
#    aws_instance.admin to be recreated with an empty /etc/letsencrypt) — the
#    self-signed file this script just wrote into the live/ path would
#    otherwise make certbot refuse with "live directory exists for <domain>"
#    and require a manual `--force-renewal` run every single time (this bit
#    us for real on 2026-08-26 — see
#    claude/ambassador-upload-cors-and-folder-fix.md in the project).
# ─────────────────────────────────────────────────────────────────────────────
echo "--- Ensuring Nginx SSL Certificates exist (Self-Signed Fallback) ---"
CERT_DIR="/etc/letsencrypt/live/${domain}"
RENEWAL_CONF="/etc/letsencrypt/renewal/${domain}.conf"

if [ -f "$RENEWAL_CONF" ]; then
  echo "Existing certbot-managed certificate found for ${domain} -- leaving it in place."
  CERTBOT_MANAGED=true
else
  CERTBOT_MANAGED=false
  mkdir -p "$CERT_DIR"
  if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
    echo "No certbot-managed certificate found -- generating a temporary self-signed fallback for ${domain}..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout "$CERT_DIR/privkey.pem" \
      -out "$CERT_DIR/fullchain.pem" \
      -subj "/CN=${domain}/O=QuizBuzz/C=IN"
  fi
fi

echo "--- Writing Nginx Configuration ---"
mkdir -p /etc/nginx/conf.d

# Remove the default nginx server block so it doesn't conflict
rm -f /etc/nginx/conf.d/default.conf

# NOTE: This heredoc is SINGLE-quoted ('NGINX_TEMPLATE') so NEITHER bash
# NOR Terraform's templatefile() touch its contents -- nginx's own $variables
# (http_upgrade, host, scheme, etc.) survive untouched. The literal string
# __DOMAIN__ is used as a placeholder and replaced with sed afterward.
cat > /etc/nginx/conf.d/quiz.conf << 'NGINX_TEMPLATE'
# Rate limit zone
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;

# WebSocket upgrade map
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name __DOMAIN__;

    # Allow Let's Encrypt HTTP-01 challenge through
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS Server block
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name __DOMAIN__;

    ssl_certificate     /etc/letsencrypt/live/__DOMAIN__/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/__DOMAIN__/privkey.pem;

    # Include basic SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Allow Let's Encrypt HTTP-01 challenge through HTTPS (for redirected challenges)
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

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

    # Health check -- must proxy directly to backend (port 3005), NOT frontend.
    location = /health {
        proxy_pass         http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header   Host       $host;
        proxy_set_header   X-Real-IP  $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout    5s;
        access_log off;
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
sed -i "s/__DOMAIN__/${domain}/g" /etc/nginx/conf.d/quiz.conf

# Tune the main nginx.conf file for high concurrency (10K+ concurrent connections)
echo "--- Tuning Nginx Main Configuration ---"
if [ -f /etc/nginx/nginx.conf ]; then
  # Set worker_processes to 8
  sed -i 's/worker_processes.*/worker_processes 8;/' /etc/nginx/nginx.conf
  
  # Insert worker_rlimit_nofile 16192 right below worker_processes
  if ! grep -q "worker_rlimit_nofile" /etc/nginx/nginx.conf; then
    sed -i '/worker_processes/a worker_rlimit_nofile 16192;' /etc/nginx/nginx.conf
  fi
  
  # Update worker_connections in the events block to 8192
  sed -i 's/worker_connections.*/worker_connections 8192;/' /etc/nginx/nginx.conf
fi

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

echo "--- Nginx started. Requesting/renewing Let's Encrypt certificate for ${domain} ---"

CERTBOT_ARGS="--nginx -d ${domain} --non-interactive --agree-tos -m ${alert_email} --redirect"
if [ "$CERTBOT_MANAGED" = false ]; then
  # No prior certbot lineage on this EBS volume -- whatever's sitting in
  # live/${domain} right now is our own self-signed placeholder from above,
  # not a real cert certbot recognizes as its own. --force-renewal makes it
  # overwrite that unconditionally instead of refusing with
  # "live directory exists for ${domain}" (previously required someone to
  # SSH in and re-run certbot by hand after every fresh instance boot).
  CERTBOT_ARGS="$CERTBOT_ARGS --force-renewal"
fi

# A handful of retries: the Elastic IP association (aws_eip_association) and
# this instance's userdata run concurrently in the same apply, so on rare
# timing there's a brief window where the domain doesn't yet resolve to THIS
# instance when the HTTP-01 challenge fires. By this point in the script
# (after all the yum/docker/compose setup above), the association has all
# but certainly already completed -- this is a safety margin, not the
# expected path.
CERTBOT_OK=false
for attempt in 1 2 3 4 5; do
  if certbot $CERTBOT_ARGS; then
    CERTBOT_OK=true
    break
  fi
  echo "certbot attempt $attempt/5 failed -- retrying in 15s..."
  sleep 15
done

if [ "$CERTBOT_OK" = true ]; then
  echo "--- Real Let's Encrypt certificate installed for ${domain} ---"
else
  echo "WARNING: certbot failed after 5 attempts -- ${domain} is still serving the self-signed fallback."
  echo "Run manually once reachable: sudo certbot --nginx -d ${domain} --non-interactive --agree-tos -m ${alert_email} --redirect --force-renewal"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 8. SYSTEMD SERVICE — auto-restart containers on EC2 reboot
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

# ─────────────────────────────────────────────────────────────────────────────
# 9. WRITE refresh-env.sh — re-sync .env from SSM without replacing EC2
# Usage: sudo /app/refresh-env.sh && docker compose up -d --force-recreate backend worker
# ─────────────────────────────────────────────────────────────────────────────
cat > /app/refresh-env.sh << 'REFRESH_EOF'
#!/bin/bash
set -euo pipefail
echo "=== Refreshing /app/.env from SSM ==="

get_ssm() {
  aws ssm get-parameter --name "$1" --with-decryption \
    --query Parameter.Value --output text --region "$AWS_DEFAULT_REGION"
}
get_ssm_optional() {
  aws ssm get-parameter --name "$1" --with-decryption \
    --query Parameter.Value --output text --region "$AWS_DEFAULT_REGION" 2>/dev/null || true
}

export AWS_DEFAULT_REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)

# Re-read all SSM secrets
DATABASE_URL=$(get_ssm /quizbuzz/prod/DATABASE_URL)
REDIS_PASSWORD=$(get_ssm /quizbuzz/prod/REDIS_PASSWORD)
JWT_ACCESS_SECRET=$(get_ssm /quizbuzz/prod/JWT_ACCESS_SECRET)
JWT_REFRESH_SECRET=$(get_ssm /quizbuzz/prod/JWT_REFRESH_SECRET)
JWT_RESET_SECRET=$(get_ssm /quizbuzz/prod/JWT_RESET_SECRET)
JWT_CONTACT_SECRET=$(get_ssm /quizbuzz/prod/JWT_CONTACT_SECRET)
OTP_SECRET=$(get_ssm /quizbuzz/prod/OTP_SECRET)
RAZORPAY_KEY_ID=$(get_ssm /quizbuzz/prod/RAZORPAY_KEY_ID)
RAZORPAY_KEY_SECRET=$(get_ssm /quizbuzz/prod/RAZORPAY_KEY_SECRET)
RAZORPAY_WEBHOOK_SECRET=$(get_ssm /quizbuzz/prod/RAZORPAY_WEBHOOK_SECRET)
SMTP_USER=$(get_ssm /quizbuzz/prod/SMTP_USER)
SMTP_PASS=$(get_ssm /quizbuzz/prod/SMTP_PASS)
AISENSY_API_KEY=$(get_ssm /quizbuzz/prod/AISENSY_API_KEY)
POSTHOG_API_KEY=$(get_ssm /quizbuzz/prod/POSTHOG_API_KEY)
POSTHOG_HOST=$(get_ssm_optional /quizbuzz/prod/POSTHOG_HOST)
SENTRY_DSN=$(get_ssm_optional /quizbuzz/prod/SENTRY_DSN)
OPS_BASE_URL=$(get_ssm_optional /quizbuzz/prod/OPS_BASE_URL)
IMAGE_TAG=$(get_ssm /quizbuzz/prod/image-tag)

# Patch all SSM-sourced values in .env
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" /app/.env
sed -i "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$REDIS_PASSWORD|" /app/.env
sed -i "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET|" /app/.env
sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|" /app/.env
sed -i "s|^JWT_RESET_SECRET=.*|JWT_RESET_SECRET=$JWT_RESET_SECRET|" /app/.env
sed -i "s|^JWT_CONTACT_SECRET=.*|JWT_CONTACT_SECRET=$JWT_CONTACT_SECRET|" /app/.env
sed -i "s|^OTP_SECRET=.*|OTP_SECRET=$OTP_SECRET|" /app/.env
sed -i "s|^RAZORPAY_KEY_ID=.*|RAZORPAY_KEY_ID=$RAZORPAY_KEY_ID|" /app/.env
sed -i "s|^RAZORPAY_KEY_SECRET=.*|RAZORPAY_KEY_SECRET=$RAZORPAY_KEY_SECRET|" /app/.env
sed -i "s|^RAZORPAY_WEBHOOK_SECRET=.*|RAZORPAY_WEBHOOK_SECRET=$RAZORPAY_WEBHOOK_SECRET|" /app/.env
sed -i "s|^SMTP_USER=.*|SMTP_USER=$SMTP_USER|" /app/.env
sed -i "s|^SMTP_PASS=.*|SMTP_PASS=$SMTP_PASS|" /app/.env
sed -i "s|^AISENSY_API_KEY=.*|AISENSY_API_KEY=$AISENSY_API_KEY|" /app/.env
sed -i "s|^POSTHOG_API_KEY=.*|POSTHOG_API_KEY=$POSTHOG_API_KEY|" /app/.env
sed -i "s|^POSTHOG_HOST=.*|POSTHOG_HOST=$POSTHOG_HOST|" /app/.env
sed -i "s|^SENTRY_DSN=.*|SENTRY_DSN=$SENTRY_DSN|" /app/.env

# OPS_BASE_URL may not exist yet on instances booted before this was added —
# patch if present, append if not (same self-healing pattern as deploy.yml).
if [ -n "$OPS_BASE_URL" ]; then
  grep -q '^OPS_BASE_URL=' /app/.env \
    && sed -i "s|^OPS_BASE_URL=.*|OPS_BASE_URL=$OPS_BASE_URL|" /app/.env \
    || echo "OPS_BASE_URL=$OPS_BASE_URL" >> /app/.env
fi

# Ensure COOKIE_DOMAIN is present
grep -q '^COOKIE_DOMAIN=' /app/.env \
  && sed -i "s|^COOKIE_DOMAIN=.*|COOKIE_DOMAIN=.ysmquizbuzz.com|" /app/.env \
  || echo 'COOKIE_DOMAIN=.ysmquizbuzz.com' >> /app/.env

echo "=== .env refreshed. Restart containers: ==="
echo "    cd /app && docker compose up -d --force-recreate backend worker"
REFRESH_EOF

chmod +x /app/refresh-env.sh
echo "refresh-env.sh installed at /app/refresh-env.sh"

echo "=== Boot script complete: $(date) ==="
echo "Run: docker compose -f /app/docker-compose.yml ps"
