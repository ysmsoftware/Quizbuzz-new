#!/bin/bash
# QuizBuzz — run-stage.sh
#
# Orchestrates ONE staged load test: starts monitor-asg.sh in the
# background, runs the k6 WS test, runs an Artillery cross-check, stops
# monitoring, then applies the gate criteria from LOAD_TEST_PLAN.md
# Section 3 and exits non-zero if the gate fails (so run-all-stages.sh
# can stop the sequence automatically).
#
# Usage:
#   ./run-stage.sh --stage 1 --base-url http://<alb-dns> --ws-url ws://<alb-dns>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$ROOT_DIR/results"

STAGE=""
BASE_URL=""
WS_URL=""
CONTEST_SLUG="load-test-contest"
TEST_TOKEN="${TEST_TOKEN:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stage) STAGE="$2"; shift 2 ;;
    --base-url) BASE_URL="$2"; shift 2 ;;
    --ws-url) WS_URL="$2"; shift 2 ;;
    --contest-slug) CONTEST_SLUG="$2"; shift 2 ;;
    --test-token) TEST_TOKEN="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$STAGE" || -z "$BASE_URL" ]]; then
  echo "Usage: $0 --stage <id> --base-url <url> [--ws-url <url>] [--contest-slug <slug>] [--test-token <token>]"
  exit 1
fi
WS_URL="${WS_URL:-${BASE_URL/http/ws}}"

# Pull this stage's config out of the single source of truth so this
# script never hardcodes user counts/timings either.
STAGE_JSON=$(python3 - "$STAGE" <<'PYEOF'
import json, sys
stage_id = int(sys.argv[1])
with open("config/stages.json") as f:
    cfg = json.load(f)
stage = next((s for s in cfg["stages"] if s["id"] == stage_id), None)
if not stage:
    sys.exit(f"Stage {stage_id} not found")
print(json.dumps(stage))
PYEOF
)
cd "$ROOT_DIR"
USERS=$(echo "$STAGE_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['users'])")
LABEL=$(echo "$STAGE_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['label'])")
RAMP_UP=$(echo "$STAGE_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['rampUpSeconds'])")
HOLD_MIN=$(echo "$STAGE_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['holdMinutes'])")
HOLD_SEC=$(( HOLD_MIN * 60 ))
EXPECTED_MIN=$(echo "$STAGE_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['expectedInstancesMin'])")
EXPECTED_MAX=$(echo "$STAGE_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['expectedInstancesMax'])")

TOTAL_RUNTIME_SEC=$(( RAMP_UP + HOLD_SEC + 120 ))

echo "════════════════════════════════════════════════════"
echo "  STAGE ${STAGE} (${LABEL}) — ${USERS} users"
echo "  Expected ASG instances: ${EXPECTED_MIN}-${EXPECTED_MAX}"
echo "  Target: ${BASE_URL}"
echo "════════════════════════════════════════════════════"

mkdir -p "$RESULTS_DIR"

# 1. Start background monitoring for the full test duration
"$SCRIPT_DIR/monitor-asg.sh" --stage "$STAGE" --duration-sec "$TOTAL_RUNTIME_SEC" &
MONITOR_PID=$!

# 2. Run k6 (primary WS test — source of truth for reconnect-resume assertion)
echo "▶ Running k6 stage ${STAGE}..."
k6 run \
  -e STAGE="$STAGE" \
  -e BASE_URL="$BASE_URL" \
  -e WS_URL="$WS_URL" \
  -e CONTEST_SLUG="$CONTEST_SLUG" \
  -e TEST_TOKEN="$TEST_TOKEN" \
  --out "json=${RESULTS_DIR}/k6-stage-${STAGE}-${LABEL}-raw.json" \
  "$ROOT_DIR/k6/quiz-load-test.js" \
  | tee "${RESULTS_DIR}/k6-stage-${STAGE}-${LABEL}.log"
K6_EXIT=$?

# 3. Run Artillery (cross-check engine, lower weight, mainly HTTP funnel
#    + a coarse WS sanity pass)
echo "▶ Running Artillery cross-check stage ${STAGE}..."
ARRIVAL_RATE=$(( USERS / RAMP_UP > 0 ? USERS / RAMP_UP : 1 ))
ARRIVAL_DURATION="$RAMP_UP" \
ARRIVAL_RATE="$ARRIVAL_RATE" \
HOLD_DURATION="$HOLD_SEC" \
BASE_URL="$BASE_URL" \
WS_URL="$WS_URL" \
TEST_TOKEN="$TEST_TOKEN" \
artillery run \
  --output "${RESULTS_DIR}/artillery-stage-${STAGE}-${LABEL}.json" \
  "$ROOT_DIR/artillery/quiz-load-test.yml" \
  | tee "${RESULTS_DIR}/artillery-stage-${STAGE}-${LABEL}.log"
ARTILLERY_EXIT=$?

# 4. Stop monitoring
wait "$MONITOR_PID" || true

# 5. Gate check — instance count actually reached the expected band at
#    some point during the run (not necessarily at the very end, since
#    scale-out can lag the hold window's start).
LATEST_MONITOR_FILE=$(ls -t "${RESULTS_DIR}"/monitor-stage-${STAGE}-*.csv | head -1)
MAX_IN_SERVICE=$(tail -n +2 "$LATEST_MONITOR_FILE" | awk -F',' '{print $3}' | grep -E '^[0-9]+$' | sort -n | tail -1)

echo ""
echo "════════════════════════════════════════════════════"
echo "  STAGE ${STAGE} (${LABEL}) RESULT"
echo "  k6 exit code:        ${K6_EXIT}"
echo "  Artillery exit code: ${ARTILLERY_EXIT}"
echo "  Max in-service ASG instances observed: ${MAX_IN_SERVICE:-NA}"
echo "  Expected range: ${EXPECTED_MIN}-${EXPECTED_MAX}"
echo "════════════════════════════════════════════════════"

GATE_PASS=1
if [[ "$K6_EXIT" -ne 0 ]]; then
  echo "❌ GATE FAIL: k6 thresholds not met (see thresholds in quiz-load-test.js)"
  GATE_PASS=0
fi
if [[ -z "${MAX_IN_SERVICE:-}" || "$MAX_IN_SERVICE" -lt "$EXPECTED_MIN" ]]; then
  echo "❌ GATE FAIL: ASG never reached expected minimum instance count (${EXPECTED_MIN})"
  GATE_PASS=0
fi
if [[ -n "${MAX_IN_SERVICE:-}" && "$MAX_IN_SERVICE" -gt "$EXPECTED_MAX" ]]; then
  echo "⚠️  WARNING: ASG scaled beyond expected max (${EXPECTED_MAX}) — investigate cost/CPU cold-start false-positive per LOAD_TEST_PLAN.md Section 6"
fi

if [[ "$GATE_PASS" -eq 1 ]]; then
  echo "✅ GATE PASS — safe to proceed to next stage"
  exit 0
else
  echo "🛑 GATE FAILED — DO NOT proceed to next stage. Diagnose using LOAD_TEST_PLAN.md Section 6."
  exit 1
fi
