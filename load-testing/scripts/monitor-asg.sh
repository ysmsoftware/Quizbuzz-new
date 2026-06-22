#!/bin/bash
# QuizBuzz — monitor-asg.sh
#
# Polls ASG desired/in-service capacity, ALB target health (both target
# groups, since admin-tg starvation is a gate condition), and ElastiCache
# metrics every POLL_INTERVAL_SEC seconds, writing a timestamped CSV so it
# can be correlated against the k6/Artillery run that's happening in
# parallel. Run this IN THE BACKGROUND for the duration of a stage:
#
#   ./monitor-asg.sh --stage 1 --duration-sec 720 &
#   MONITOR_PID=$!
#   ... run k6/artillery ...
#   wait $MONITOR_PID
#
# Requires: aws cli configured with read access to autoscaling, elbv2,
# elasticache, cloudwatch (read-only is sufficient).

set -euo pipefail

POLL_INTERVAL_SEC="${POLL_INTERVAL_SEC:-15}"
ASG_NAME="${ASG_NAME:-quizbuzz-quiz-asg}"
QUIZ_TG_ARN="${QUIZ_TG_ARN:-}"
ADMIN_TG_ARN="${ADMIN_TG_ARN:-}"
REDIS_CLUSTER_ID="${REDIS_CLUSTER_ID:-quizbuzz-live-redis}"
RESULTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../results" && pwd)"

STAGE="0"
DURATION_SEC="600"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stage) STAGE="$2"; shift 2 ;;
    --duration-sec) DURATION_SEC="$2"; shift 2 ;;
    --asg-name) ASG_NAME="$2"; shift 2 ;;
    --quiz-tg-arn) QUIZ_TG_ARN="$2"; shift 2 ;;
    --admin-tg-arn) ADMIN_TG_ARN="$2"; shift 2 ;;
    --redis-cluster-id) REDIS_CLUSTER_ID="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$QUIZ_TG_ARN" || -z "$ADMIN_TG_ARN" ]]; then
  echo "Resolving target group ARNs via terraform output..."
  cd "$(dirname "${BASH_SOURCE[0]}")/../../terraform/environments/prod"
  QUIZ_TG_ARN="${QUIZ_TG_ARN:-$(terraform output -raw quiz_tg_arn 2>/dev/null || echo "")}"
  ADMIN_TG_ARN="${ADMIN_TG_ARN:-$(terraform output -raw admin_tg_arn 2>/dev/null || echo "")}"
  cd - > /dev/null
fi

OUT_FILE="${RESULTS_DIR}/monitor-stage-${STAGE}-$(date +%Y%m%dT%H%M%S).csv"
echo "timestamp,desired_capacity,in_service_instances,quiz_tg_healthy,quiz_tg_unhealthy,admin_tg_healthy,admin_tg_unhealthy,redis_cpu_pct,redis_curr_connections" > "$OUT_FILE"
echo "Writing ASG/ALB/Redis metrics to: $OUT_FILE"

END_TIME=$(( $(date +%s) + DURATION_SEC ))

while [[ $(date +%s) -lt $END_TIME ]]; do
  TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  ASG_JSON=$(aws autoscaling describe-auto-scaling-groups \
    --auto-scaling-group-names "$ASG_NAME" \
    --query 'AutoScalingGroups[0].{Desired:DesiredCapacity,InService:length(Instances[?LifecycleState==`InService`])}' \
    --output json 2>/dev/null || echo '{"Desired":"NA","InService":"NA"}')
  DESIRED=$(echo "$ASG_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin).get('Desired','NA'))" 2>/dev/null || echo "NA")
  IN_SERVICE=$(echo "$ASG_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin).get('InService','NA'))" 2>/dev/null || echo "NA")

  if [[ -n "$QUIZ_TG_ARN" ]]; then
    QUIZ_HEALTHY=$(aws elbv2 describe-target-health --target-group-arn "$QUIZ_TG_ARN" \
      --query "length(TargetHealthDescriptions[?TargetHealth.State=='healthy'])" --output text 2>/dev/null || echo "NA")
    QUIZ_UNHEALTHY=$(aws elbv2 describe-target-health --target-group-arn "$QUIZ_TG_ARN" \
      --query "length(TargetHealthDescriptions[?TargetHealth.State!='healthy'])" --output text 2>/dev/null || echo "NA")
  else
    QUIZ_HEALTHY="NA"; QUIZ_UNHEALTHY="NA"
  fi

  if [[ -n "$ADMIN_TG_ARN" ]]; then
    ADMIN_HEALTHY=$(aws elbv2 describe-target-health --target-group-arn "$ADMIN_TG_ARN" \
      --query "length(TargetHealthDescriptions[?TargetHealth.State=='healthy'])" --output text 2>/dev/null || echo "NA")
    ADMIN_UNHEALTHY=$(aws elbv2 describe-target-health --target-group-arn "$ADMIN_TG_ARN" \
      --query "length(TargetHealthDescriptions[?TargetHealth.State!='healthy'])" --output text 2>/dev/null || echo "NA")
  else
    ADMIN_HEALTHY="NA"; ADMIN_UNHEALTHY="NA"
  fi

  REDIS_CPU=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/ElastiCache --metric-name CPUUtilization \
    --dimensions Name=CacheClusterId,Value="${REDIS_CLUSTER_ID}-001" \
    --start-time "$(date -u -d '-2 minutes' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-2M +%Y-%m-%dT%H:%M:%SZ)" \
    --end-time "$TS" --period 60 --statistics Average \
    --query 'Datapoints[0].Average' --output text 2>/dev/null || echo "NA")

  REDIS_CONN=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/ElastiCache --metric-name CurrConnections \
    --dimensions Name=CacheClusterId,Value="${REDIS_CLUSTER_ID}-001" \
    --start-time "$(date -u -d '-2 minutes' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-2M +%Y-%m-%dT%H:%M:%SZ)" \
    --end-time "$TS" --period 60 --statistics Average \
    --query 'Datapoints[0].Average' --output text 2>/dev/null || echo "NA")

  echo "${TS},${DESIRED},${IN_SERVICE},${QUIZ_HEALTHY},${QUIZ_UNHEALTHY},${ADMIN_HEALTHY},${ADMIN_UNHEALTHY},${REDIS_CPU},${REDIS_CONN}" >> "$OUT_FILE"
  echo "[$TS] desired=${DESIRED} inService=${IN_SERVICE} quizHealthy=${QUIZ_HEALTHY} adminHealthy=${ADMIN_HEALTHY} redisCPU=${REDIS_CPU}%"

  sleep "$POLL_INTERVAL_SEC"
done

echo "Monitoring complete: $OUT_FILE"
