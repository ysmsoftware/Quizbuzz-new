# QuizBuzz Load Testing

See `LOAD_TEST_PLAN.md` for the full strategy. Quick start:

## Prerequisites
- `k6` installed (https://k6.io/docs/get-started/installation/)
- `artillery` installed: `npm install -g artillery artillery-plugin-metrics-by-endpoint`
- `aws` CLI configured with read access to autoscaling/elbv2/elasticache/cloudwatch
- `python3` available (used by the orchestration scripts to read `config/stages.json`)
- Live infra already applied: `terraform apply -var="mode=live" -var="expected_participants=<N>"`
  from `terraform/environments/prod`, or run via `./scripts/go-live.sh` per `DEPLOYMENT_PLAN.md`

## Before your first real run
1. In `config/stages.json`, set `"domain"` to your ALB DNS name
   (`terraform output -raw alb_dns_name` from `terraform/environments/prod`) —
   load test against the ALB directly, not the manually-switched
   `host.co.in` A record, to avoid DNS TTL noise polluting results.
2. Confirm the actual route paths in `k6/quiz-load-test.js` /
   `artillery/quiz-load-test.yml` (`/api/v1/contests/:slug/join`, the
   `quiz:v1:*` event names) against your real backend routes — these are
   written to match `quiz_module_deep_dive.md` and `DEPLOYMENT_PLAN.md`'s
   own sample but MUST be verified against actual code before trusting
   results.
3. Seed a real `load-test-contest` in the DB (or a dedicated test
   organization) with a realistic question count matching
   `config/stages.json`'s `questionsPerQuiz`.
4. Get a valid `TEST_TOKEN` (or wire up the join endpoint to issue real
   per-VU tokens, which `quiz-load-test.js` already attempts via the
   join response body — preferred over one shared token if your auth
   middleware rejects token reuse across many concurrent sockets).

## Run everything (recommended)
```bash
cd load-testing
chmod +x scripts/*.sh
./scripts/run-all-stages.sh --base-url http://<alb-dns> --test-token <token>
```
Stops automatically the first time a stage's gate fails (success rate,
latency, ASG instance count, etc. — see `LOAD_TEST_PLAN.md` Section 3).

## Run a single stage
```bash
./scripts/run-stage.sh --stage 3 --base-url http://<alb-dns> --test-token <token>
```

## Resume after a fix
```bash
./scripts/run-all-stages.sh --base-url http://<alb-dns> --start-stage 3 --test-token <token>
```

## Results
Everything lands in `results/` (gitignored): per-stage k6 JSON summaries,
Artillery JSON reports, and `monitor-stage-*.csv` files correlating ASG/ALB/
ElastiCache metrics against the same time window.

When fully done, tear down live infra:
```bash
cd ../terraform/environments/prod && terraform apply -var="mode=idle" -auto-approve
```
