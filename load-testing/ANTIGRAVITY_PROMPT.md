# Prompt for Antigravity Code Editor — QuizBuzz Auto-Scaling Load Test Execution

Copy everything between the lines below into Antigravity as your task brief.
It's scoped from the `testing-qa` skill bundle (8 phases: Strategy, Unit,
Integration, E2E, Browser Automation, Performance, Code Review, Quality
Gates) down to what this specific job needs — Phase 6 (Performance Testing)
as the spine, pulling in just enough of Phases 1, 3, and 7 to make the
performance numbers trustworthy. Don't run the full unit/E2E/browser sweep
as part of this task; that's a separate pass on the application code itself,
not the load-testing harness.

---

## TASK BRIEF

You are working in the QuizBuzz monorepo at:
- Backend: `backend/`
- Frontend: `frontend/`
- Terraform: `terraform/`
- Load testing harness (already scaffolded by Claude, your job is to
  validate/extend/run it): `load-testing/`

### Context you must read FIRST, in this order
1. `load-testing/LOAD_TEST_PLAN.md` — the full strategy, gate criteria, and
   known risk areas (especially Section 0 and Section 6 — the documented
   CPU cold-start false-positive scale-out issue already observed once).
2. `terraform/modules/live_contest/asg.tf`, `main.tf`, `elasticache.tf`,
   `variables.tf` — the actual infrastructure being tested. Pay close
   attention to the inline comments; they document a REAL production
   incident (ALB never had a healthy target because `health_check_grace_period`
   was originally too short) and a REAL observed anomaly (a 3rd instance
   appeared with zero real traffic due to CPU target-tracking cold start).
   Your job is to either reproduce/confirm these are now handled, or prove
   they still happen.
3. `backend/src/modules/quiz/` (or wherever the quiz module actually lives —
   confirm the real path first) — the real Socket.IO event names, payload
   shapes, and REST route paths. The pre-written `load-testing/k6/quiz-load-test.js`
   and `load-testing/artillery/quiz-load-test.yml` were written against
   names inferred from `quiz_module_deep_dive.md` and `DEPLOYMENT_PLAN.md`
   (`quiz:v1:join`, `quiz:v1:question_start`, `quiz:v1:answer`,
   `quiz:v1:submit`, `/api/v1/contests/:slug/join`) — these are EDUCATED
   GUESSES based on documentation, not verified against running code. You
   MUST cross-check every event name and payload field against the actual
   gateway/controller source before trusting any test result.
4. `backend/src/config/` (the Zod-validated config schema) — confirm what
   env vars actually exist on a real running instance so your load test
   target URLs, ports (note: Terraform's `live_contest` module uses port
   **3005**, not 3000 — already corrected in the Terraform comments, make
   sure the load test scripts agree), and auth token format match reality.

### Your job, in order

**Step 1 — Verify, don't assume (Phase 1: Test Strategy, scoped)**
- Read the real quiz module source and produce a short diff report:
  "load-testing scripts assume X, actual code does Y" for every mismatch
  found in event names, route paths, payload shapes, and auth flow.
- Fix `load-testing/k6/quiz-load-test.js` and
  `load-testing/artillery/quiz-load-test.yml` to match reality. Do NOT
  change `load-testing/config/stages.json` user counts/timings without
  asking — those numbers are the deliberately staged 1k/2k/4k/5k/6k/10k
  plan and should stay config-driven, not hardcoded into the scripts.

**Step 2 — Integration sanity pass (Phase 3, scoped)**
- Before running any real load, run Stage 0 (50 users) against whatever
  environment is available (local Docker Compose if live AWS infra isn't
  up yet, otherwise the real ALB) purely to confirm the scripts can
  complete a full join -> answer -> submit cycle without errors. This is
  a correctness check, not a load check — fix any script bugs here before
  they get masked by load-related noise at higher stages.

**Step 3 — Run the staged load test (Phase 6: Performance Testing — the
core of this task)**
- Once Step 1 and Step 2 are clean, run the actual staged sequence against
  real `mode=live` AWS infrastructure using
  `load-testing/scripts/run-all-stages.sh`, OR stage-by-stage with
  `run-stage.sh` if you want to inspect results between each one (recommended
  for the first full run, since this is the first time these scripts touch
  real infra).
- Respect the gate-and-stop behavior already built into these scripts: if a
  stage's gate fails (success rate, p95 latency, ASG instance count,
  ElastiCache thresholds — see `LOAD_TEST_PLAN.md` Section 3), STOP. Don't
  push through to the next stage. Diagnose using Section 6's table first.
- Pay special attention to Stage 1 (1,000 users): this is specifically
  designed to catch the documented CPU-cold-start false-positive before
  it's confused with real scale-out behavior at Stage 2+. Report explicitly
  whether you observe a premature/unexplained extra instance at this stage.
- For every stage, capture and report:
  - Max ASG instances reached vs expected range (from `config/stages.json`)
  - Time-to-healthy for any newly scaled-out instance (correlate
    `monitor-stage-*.csv` timestamps against when the instance entered
    `InService`/`healthy` — compare against the 420s grace period assumption)
  - WebSocket connection success rate
  - `answer_latency` p95/p99
  - Whether sticky sessions held (no participant got bounced to a different
    backend instance mid-quiz unless they deliberately disconnected)
  - Reconnect-resume correctness: did reconnected participants resume at
    their correct question index, or restart from question 0? (This is the
    single most important functional correctness check riding along with
    the load test — flag any failure here as a P0, not just a performance
    note, since it directly contradicts the documented 3-layer reconnect
    design.)
  - admin-tg health/error rate throughout (proves quiz load isn't starving
    the admin dashboard sharing the same ALB)

**Step 4 — Report (Phase 7, scoped to findings relevant here)**
- Produce a single results document
  `load-testing/results/LOAD_TEST_REPORT_<date>.md` summarizing, per stage:
  pass/fail against gate criteria, the metrics above, and any anomalies.
- For any FAILED gate, do root-cause diagnosis using
  `LOAD_TEST_PLAN.md` Section 6 as a starting checklist, but go further:
  pull actual CloudWatch alarm history, actual `/var/log/user-data.log`
  timestamps via SSM on any instance that scaled out, and actual
  application logs (Sentry/CloudWatch) for the affected time window. Don't
  just restate the plan's hypotheses — confirm or rule them out with real
  evidence.
- If you find the ASG `cpu_scale_out` policy is genuinely unreliable at
  scale (not just a one-time cold-start blip), implement the fix already
  proposed in `asg.tf`'s own comments: replace the CPU-based
  `TargetTrackingScaling` policy with a `StepScaling` policy driven by a
  custom CloudWatch alarm on ALB `RequestCountPerTarget` (a more honest
  signal of real quiz load than CPU). Do this as a separate, clearly
  labeled Terraform change — do not silently fold it into the load-testing
  harness.

### Hard constraints (from project rules — do not violate)
- No hardcoded user counts, thresholds, or limits anywhere you touch —
  everything config-driven via `config/stages.json` or environment
  variables, matching the existing pattern.
- No scale-in testing in this pass — `disable_scale_in = true` is
  intentional (see `asg.tf` comments: scale-in is a deliberate human action
  via `go-idle.sh`, never automatic during a live contest). Don't add or
  test automatic scale-in behavior.
- Always run `terraform apply -var="mode=idle"` (or `go-idle.sh`) after
  finishing or aborting a test run — never leave `mode=live` infrastructure
  running unattended; it costs real money per the cost table in
  `DEPLOYMENT_PLAN.md`.
- Stop and ask before changing anything in `terraform/modules/live_contest/`
  beyond the StepScaling fix explicitly scoped in Step 4 — this module
  controls real production auto-scaling behavior, not test infrastructure.
- If a gate fails at any stage, do not "loosen the gate" to make it pass —
  fix the underlying infra/code issue, or escalate back with findings if
  the fix is out of scope for this task.

---

## Standalone k6 quick-reference (if you only need this part)

```bash
cd load-testing
k6 run -e STAGE=1 -e BASE_URL=http://<alb-dns> -e WS_URL=ws://<alb-dns> \
  -e CONTEST_SLUG=load-test-contest -e TEST_TOKEN=<token> \
  k6/quiz-load-test.js
```

## Standalone Artillery quick-reference (if you only need this part)

```bash
cd load-testing/artillery
ARRIVAL_DURATION=20 ARRIVAL_RATE=50 HOLD_DURATION=600 \
BASE_URL=http://<alb-dns> WS_URL=ws://<alb-dns> TEST_TOKEN=<token> \
artillery run quiz-load-test.yml
```
