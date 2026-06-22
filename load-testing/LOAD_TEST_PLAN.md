# QuizBuzz — Load Testing & Auto-Scaling Verification Plan

This plan validates that `terraform/modules/live_contest` (ALB + ASG + ElastiCache)
actually scales correctly under real WebSocket load, before trusting it with a
real contest and real users' money.

## 0. What we're actually testing

Reading `asg.tf` / `main.tf`, several things are configured but NOT yet proven
under real load:

| # | Config claim | File | Must verify under load |
|---|---|---|---|
| 1 | ALB routes `/socket.io/*` and quiz REST paths to `quiz-tg`, everything else to `admin-tg` | `live_contest/main.tf` listener rules | Correct routing under concurrent connections, not just curl |
| 2 | Sticky sessions (`lb_cookie`, 86400s) keep a participant pinned to one instance | `main.tf` quiz-tg `stickiness` block | Reconnects land on the same instance; no cross-instance session loss |
| 3 | ASG scales OUT on CPU > 60%, never scales IN (`disable_scale_in = true`) | `asg.tf` `cpu_scale_out` policy | Real scale-out event fires at real thresholds, not the false-positive cold-start "3rd instance" issue already noted in the comments |
| 4 | `health_check_grace_period = 420` / `instance_warmup = 420` is enough for real cold boot | `asg.tf` | New instances become healthy and start taking traffic within ~7 min during a live ramp, not just on a quiet apply |
| 5 | Redis (ElastiCache `r6g.large`) holds quiz state under concurrent writes from N instances | `elasticache.tf` | No answer loss / no session corruption as instance count grows |

Known risk flagged in your own Terraform comments: CPU-based target tracking can
misfire on cold start because idle background CPU (Docker, BullMQ polling,
CloudWatch agent) looks high before it stabilizes. Stage 1 (1,000 users) is
explicitly designed to catch this *before* it gets confused with real scale-out
under Stage 3+.

## 1. Tools

- **k6** — primary tool for WebSocket-heavy ramp scenarios (native `ws` module,
  good metrics, easy CI integration, free).
- **Artillery** — secondary tool, used as a cross-check on k6's WebSocket
  numbers with a different engine, plus the HTTP-only registration/payment
  funnel (pre-quiz). A scaling claim should never rest on a single tool.
- **CloudWatch + a bash poller** (`scripts/monitor-asg.sh`) — records ASG
  desired/actual capacity, target health, and ALB/ElastiCache metrics in
  lockstep with each test stage, timestamp-correlated with the k6/Artillery
  run, since the load tools only see the client side.

Both scripts read the same staged scenario values from `config/stages.json` —
the actual user counts/timings live in ONE place, not duplicated across k6 and
Artillery files. This matches your config-agnostic rule: no hardcoded user
counts inside test logic.

## 2. Staged scenarios

| Stage | Concurrent users (VUs) | Purpose | Expected ASG instances (1 per ~1000, cap 10) |
|---|---|---|---|
| 0 | 50 | Smoke test — confirms routing, sticky sessions, health checks work at all before spending money on bigger stages | 2 (min_size) |
| 1 | 1,000 | Baseline — confirms whether the CPU cold-start false-positive happens | 2–3 |
| 2 | 2,000 | First real scale-out trigger zone | 3–4 |
| 3 | 4,000 | Mid-scale — confirms scale-out keeps pace with ramp speed, not just steady state | 4–5 |
| 4 | 5,000 | Matches DEPLOYMENT_PLAN.md's documented 5k cost/capacity reference point | 5 |
| 5 | 6,000 | Past the documented 5k reference — confirms no cliff between 5k and 6k | 6 |
| 6 | 10,000 | Hard cap test — confirms ASG respects `max_size = 10`, confirms ALB/ElastiCache survive at the documented ceiling | 10 |

Each stage runs as **ramp-up → hold → ramp-down**, never an instant spike — an
instant spike tests burst tolerance, a different property from sustained-load
auto-scaling, and your `health_check_grace_period` math assumes a realistic ramp.

Default per-stage timing (overridable via `config/stages.json`):
```
ramp-up:   stage_users / 50 per second   (e.g. 1,000 users -> ~20s ramp)
hold:      10 min (Stage 0-2), 15 min (Stage 3-5), 20 min (Stage 6)
ramp-down: 2 min
```
Hold time must comfortably exceed `health_check_grace_period` (420s ≈ 7 min) so
a scale-out event has time to register a NEW healthy target before the stage
ends — a hold shorter than that makes "did scaling actually work" unanswerable.

## 3. Run order & gating

Run stages **sequentially, never in parallel**, and require each stage to pass
its gate before spending money on the next:

```
Stage 0 (50)    -> PASS gate -> Stage 1 (1,000)
Stage 1 (1,000) -> PASS gate -> Stage 2 (2,000)
Stage 2 (2,000) -> PASS gate -> Stage 3 (4,000)
Stage 3 (4,000) -> PASS gate -> Stage 4 (5,000)
Stage 4 (5,000) -> PASS gate -> Stage 5 (6,000)
Stage 5 (6,000) -> PASS gate -> Stage 6 (10,000)
```

### Gate criteria (ALL must pass to proceed)

1. WebSocket connection success rate >= 99%
2. `answer_latency` p95 < 500ms (your own DEPLOYMENT_PLAN.md threshold)
3. Zero participants stuck mid-question-resume on reconnect (sticky session check)
4. ASG `GroupInServiceInstances` matches the expected range for that stage
   within the grace-period window — recorded by `scripts/monitor-asg.sh`
5. No 5xx spike on `admin-tg` (proves quiz load isn't starving admin traffic —
   both target groups share the same ALB)
6. ElastiCache `CPUUtilization` / `CurrConnections` stays under 70% — early
   warning the `r6g.large` node needs upsizing before 10k, not after a failed
   real contest

If a stage fails, **stop** — do not proceed. Diagnose first (Section 6):
failures compound, an ASG that mis-scales at 2,000 will not behave at 10,000.

### Between stages

Leave `mode=live` active across the whole sequence (no `go-idle` between
stages) — this is realistic, since a real contest doesn't reset infrastructure
between user waves, and it also tests that scale-out state carries forward
correctly. Only run `go-idle.sh` after Stage 6 completes, or after a failed
gate once diagnosis is done.

## 4. What each tool simulates

Matches your actual flow (waiting room -> join -> question_start -> answer ->
submit) using your real event names from `quiz_module_deep_dive.md` and the
k6 sample already in `DEPLOYMENT_PLAN.md`:

1. `POST /api/v1/contests/:id/join` (HTTP) — exchanges OTP/registration ref for
   a scoped socket token (per your `JWT_CONTACT_SECRET` socket-auth pattern)
2. WS connect to `/socket.io/?EIO=4&transport=websocket`
3. Emit `quiz:v1:join`
4. Wait for `quiz:v1:question_start`
5. Sleep 10-30s (simulated think time)
6. Emit `quiz:v1:answer`
7. Repeat for N questions
8. Emit `quiz:v1:submit` for most VUs; let a subset hit the contest duration
   and rely on server-side auto-submit instead, so that path gets exercised too
9. A random ~5% of VUs disconnect mid-quiz and reconnect 5-15s later, to
   specifically exercise the 3-layer reconnect-resume logic (live Redis hash
   -> Redis set rebuild -> waiting room fallback)

## 5. File layout

```
load-testing/
├── LOAD_TEST_PLAN.md          (this file)
├── config/
│   └── stages.json            (single source of truth for all stage values)
├── k6/
│   ├── quiz-load-test.js      (primary WS load test, staged)
│   └── lib/
│       └── helpers.js
├── artillery/
│   ├── quiz-load-test.yml     (cross-check WS test + HTTP registration funnel)
│   └── processor.js
├── scripts/
│   ├── monitor-asg.sh         (polls ASG/ALB/ElastiCache during a run -> CSV)
│   ├── run-stage.sh           (orchestrates one stage + gate check)
│   └── run-all-stages.sh      (sequential runner, stops on first failed gate)
└── results/                   (gitignored — CSV/JSON output per stage/run)
```

## 6. Diagnosing a failed gate

| Symptom | Likely cause | Where to look |
|---|---|---|
| ASG never scales out despite CPU > 60% sustained | Still mid-cooldown from a prior premature scale-out (the documented cold-start "3rd instance" issue) | CloudWatch `GroupDesiredCapacity` history vs `cpu_scale_out` alarm history |
| New instance registers but stays "unhealthy" past grace period | `/health` not responding within the real `userdata.sh.tpl` boot sequence | SSM into the instance, check `/var/log/user-data.log` timestamps and `docker compose logs` |
| Connection success rate drops sharply at one stage, not gradually | Sticky-session cookie not honored — check `Set-Cookie` is a real `lb_cookie`, not stripped upstream | Raw response headers from k6/Artillery |
| Answer latency spikes only on recently-scaled instances | Cold connection-pool warm-up on the new instance (`DB_POOL_MIN`/`DB_POOL_MAX`) | Per-instance latency, tag metrics by `instance_id` |
| Redis CPU spikes disproportionately to user count | BullMQ polling overhead scaling with instance count, not user count (flagged in `asg.tf` comments) | ElastiCache `CPUUtilization` vs ASG `desired_capacity` over time |
| Admin dashboard goes slow/5xx during quiz load | Quiz traffic leaking past listener rules onto `admin-tg`'s shared t3.small | Verify `aws_lb_listener_rule` path patterns match your actual quiz route paths exactly |

## 7. Cost awareness while testing

Per `DEPLOYMENT_PLAN.md`'s own cost table, Stage 6 (10 instances + ALB +
ElastiCache for the run duration) costs roughly the same as the documented
"10,000 users" line (~$20-30 for the live window). Running all 7 stages
sequentially in one day costs a few dollars total — cheap compared to finding
these problems live. Always run `./scripts/go-idle.sh` (or
`terraform apply -var="mode=idle"`) immediately after the last stage,
success or failure.
