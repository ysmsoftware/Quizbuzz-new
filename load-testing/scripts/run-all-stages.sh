#!/bin/bash
# QuizBuzz — run-all-stages.sh
#
# Runs all 7 stages sequentially (0, 1, 2, 3, 4, 5, 6 = 50, 1k, 2k, 4k,
# 5k, 6k, 10k users), stopping immediately if any stage's gate fails, per
# LOAD_TEST_PLAN.md Section 3. Does NOT run go-idle.sh automatically —
# that's a deliberate manual step after you've reviewed final results.
#
# Usage:
#   ./run-all-stages.sh --base-url http://<alb-dns> [--ws-url ws://<alb-dns>] \
#       [--start-stage 0] [--test-token xxx]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BASE_URL=""
WS_URL=""
START_STAGE=0
TEST_TOKEN="${TEST_TOKEN:-}"
CONTEST_SLUG="load-test-contest"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url) BASE_URL="$2"; shift 2 ;;
    --ws-url) WS_URL="$2"; shift 2 ;;
    --start-stage) START_STAGE="$2"; shift 2 ;;
    --test-token) TEST_TOKEN="$2"; shift 2 ;;
    --contest-slug) CONTEST_SLUG="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$BASE_URL" ]]; then
  echo "Usage: $0 --base-url <url> [--ws-url <url>] [--start-stage 0] [--test-token xxx]"
  exit 1
fi

STAGE_IDS=(0 1 2 3 4 5 6)
STAGE_LABELS=("50 (smoke)" "1,000 (baseline)" "2,000 (scale-out)" "4,000 (mid-scale)" "5,000 (reference)" "6,000 (above-ref)" "10,000 (hard cap)")

echo "════════════════════════════════════════════════════"
echo "  QuizBuzz Auto-Scaling Load Test — FULL SEQUENCE"
echo "  Starting from stage ${START_STAGE}"
echo "  Target: ${BASE_URL}"
echo "  Reminder: this leaves mode=live infra running between stages."
echo "  Run go-idle.sh / terraform apply -var=\"mode=idle\" when fully done."
echo "════════════════════════════════════════════════════"

for i in "${!STAGE_IDS[@]}"; do
  STAGE_ID="${STAGE_IDS[$i]}"
  if [[ "$STAGE_ID" -lt "$START_STAGE" ]]; then
    continue
  fi

  echo ""
  echo ">>> Starting Stage ${STAGE_ID}: ${STAGE_LABELS[$i]} users"

  if ! "$SCRIPT_DIR/run-stage.sh" \
      --stage "$STAGE_ID" \
      --base-url "$BASE_URL" \
      --ws-url "${WS_URL:-${BASE_URL/http/ws}}" \
      --contest-slug "$CONTEST_SLUG" \
      --test-token "$TEST_TOKEN"; then
    echo ""
    echo "🛑 SEQUENCE STOPPED at Stage ${STAGE_ID} (${STAGE_LABELS[$i]} users) — gate failed."
    echo "   Diagnose using LOAD_TEST_PLAN.md Section 6 before re-running."
    echo "   Resume later with: $0 --base-url ${BASE_URL} --start-stage ${STAGE_ID}"
    exit 1
  fi

  echo "✅ Stage ${STAGE_ID} passed. Cooling down 60s before next stage..."
  sleep 60
done

echo ""
echo "════════════════════════════════════════════════════"
echo "  ✅ ALL STAGES PASSED — up to 10,000 concurrent users"
echo "  Review results/ for the full CSV/JSON history."
echo "  Now run go-idle.sh to tear down live_contest resources."
echo "════════════════════════════════════════════════════"
