# LIVE CONTEST MODULE — ELASTICACHE REDIS
#
# WHY THIS EXISTS:
# During idle mode, Redis runs as a single Docker container on the admin
# t2.small EC2 — fine for low admin traffic. During a live contest, ALL
# quiz instances (potentially 10 of them) need to share ONE Redis, because:
#   - Quiz session state (per docs: "Redis-only state during live contests")
#     must be visible to whichever instance a participant's sticky session
#     lands on if they reconnect to a different instance after a failure.
#   - Socket.IO's Redis adapter needs a shared pub/sub layer so an event
#     emitted from instance A reaches a participant connected to instance B.
#   - BullMQ queues (submission, evaluation, certificate generation) need
#     one shared queue, not 10 independent ones.
#
# A single-container Redis on one EC2 cannot serve this — it would mean
# each quiz instance has its own isolated Redis, breaking session resume,
# pub/sub broadcast, and queue processing across the fleet.
#
# WHY ElastiCache REPLICATION GROUP (not a single cache cluster):
# automatic_failover_enabled requires a replication group, even for just
# primary + 1 replica. This protects against the primary node failing
# mid-contest, which without failover would mean total Redis data loss —
# every participant's in-progress answers, session state, and the live
# leaderboard's source data — for whoever is mid-quiz at that moment.

resource "aws_elasticache_subnet_group" "redis" {
  name        = "quizbuzz-live-redis-subnet-group"
  subnet_ids  = var.quiz_private_subnets
  description = "Quiz-compute-tier subnets - keeps Redis network-adjacent to the quiz EC2 fleet, never internet-reachable"
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "quizbuzz-live-redis"
  description           = "QuizBuzz live contest Redis - shared session state, pub/sub, and BullMQ queues across the quiz EC2 fleet"

  # cache.r6g.large: 2 vCPU, ~13GB memory. Sized for ~10k concurrent
  # WebSocket sessions' worth of Redis keys (session hashes, answer sets,
  # heartbeat TTLs) plus BullMQ job data, with headroom. Memory, not CPU,
  # is almost always the binding constraint for Redis at this scale.
  node_type = "cache.r6g.large"

  # 2 nodes = 1 primary + 1 replica. This is the minimum required for
  # automatic_failover_enabled to actually do anything.
  num_cache_clusters = 2

  engine_version = "7.0"
  port           = 6379

  # If the primary node fails mid-contest, ElastiCache automatically
  # promotes the replica to primary — typically within ~30-60 seconds.
  # Combined with ioredis's built-in reconnect logic in the backend, this
  # is what keeps a mid-quiz Redis failure from becoming a total outage.
  automatic_failover_enabled = true

  # Spreads primary and replica across different Availability Zones, so
  # an entire-AZ outage (rare, but it happens) doesn't take out both
  # nodes simultaneously.
  multi_az_enabled = true

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [var.elasticache_sg_id]

  at_rest_encryption_enabled = true

  # Deliberately false: Socket.IO's Redis adapter and BullMQ both have
  # known compatibility friction with Redis TLS (transit encryption) in
  # some client library versions. Since this traffic never leaves the
  # VPC's private subnets (no internet exposure regardless), the security
  # benefit of transit encryption here is marginal compared to the risk
  # of connection issues mid-contest. Revisit if ioredis/BullMQ versions
  # are confirmed TLS-compatible in a controlled test first.
  transit_encryption_enabled = false

  # No cluster mode (sharding) — a single shard with one replica is
  # suficient at this scale and keeps the Socket.IO Redis adapter and
  # BullMQ both fully compatible (cluster mode requires client-side
  # awareness of hash slots that not all adapter versions handle well).
  # If a future scale tier (50k+ concurrent) needs more Redis throughput
  # than a single r6g.large can give, that's when cluster mode becomes
  # worth the added complexity — not before.

  # Auto minor version upgrades during maintenance window — keeps patches
  # current without manual intervention, low risk since this is a fresh
  # replication group on each live-mode boot, not long-lived state.
  auto_minor_version_upgrade = true
  maintenance_window         = "mon:20:00-mon:21:00" # 1:30am IST Monday — lowest-traffic window

  tags = {
    Name    = "quizbuzz-live-redis"
    Purpose = "quiz-session-state-pubsub-bullmq"
  }
}

output "redis_primary_endpoint" {
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  description = "Primary Redis endpoint — set as REDIS_HOST in quiz EC2 .env files (see userdata.sh.tpl)"
}

output "redis_reader_endpoint" {
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
  description = "Reader endpoint — not currently used (backend reads/writes through primary only), available if read-scaling becomes necessary later"
}
