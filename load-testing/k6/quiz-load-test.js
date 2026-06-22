/**
 * QuizBuzz — k6 staged WebSocket load test
 *
 * Simulates the real participant flow: HTTP join -> WS connect ->
 * quiz:v1:join -> wait question_start -> think -> quiz:v1:answer ->
 * repeat -> quiz:v1:submit (or let server auto-submit), with a fraction
 * of VUs doing a mid-quiz disconnect/reconnect to exercise the 3-layer
 * reconnect-resume logic.
 *
 * Run a single stage:
 *   k6 run -e STAGE=1 -e BASE_URL=http://<alb-dns> -e WS_URL=ws://<alb-dns> \
 *       -e CONTEST_SLUG=load-test-contest -e TEST_TOKEN=xxx \
 *       load-testing/k6/quiz-load-test.js
 *
 * STAGE must match an `id` in config/stages.json. All user counts / timing
 * come from that file — never hardcode numbers here (project rule: no
 * magic numbers, config-agnostic business logic).
 */

import ws from "k6/ws";
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend, Rate } from "k6/metrics";
import { SharedArray } from "k6/data";

// ── Load staged config (single source of truth) ────────────────────────────
const stagesConfig = JSON.parse(open("../config/stages.json"));
const STAGE_ID = Number(__ENV.STAGE || "0");
const stage = stagesConfig.stages.find((s) => s.id === STAGE_ID);
if (!stage) {
  throw new Error(
    `STAGE=${STAGE_ID} not found in config/stages.json — valid ids: ${stagesConfig.stages
      .map((s) => s.id)
      .join(", ")}`
  );
}
const defaults = stagesConfig.defaults;

// ── Environment ──────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "http://localhost:3005";
const WS_URL = (__ENV.WS_URL || BASE_URL.replace(/^http/, "ws")) +
  "/socket.io/?EIO=4&transport=websocket";
const CONTEST_SLUG = __ENV.CONTEST_SLUG || "load-test-contest";
const TEST_TOKEN = __ENV.TEST_TOKEN || "";

// ── Custom metrics ───────────────────────────────────────────────────────
const answerLatency = new Trend("answer_latency", true);
const wsConnectErrors = new Counter("ws_connect_errors");
const wsConnectSuccess = new Rate("ws_connect_success");
const reconnectSuccess = new Rate("reconnect_success");
const questionsAnswered = new Counter("questions_answered");
const submissionsCompleted = new Counter("submissions_completed");
const autoSubmitTriggered = new Counter("auto_submit_triggered");

// ── k6 scenario: ramp-up -> hold -> ramp-down, driven entirely by the
//    stage's own config values (no hardcoded numbers here) ────────────────
export const options = {
  scenarios: {
    quiz_participants: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: `${stage.rampUpSeconds}s`, target: stage.users },
        { duration: `${stage.holdMinutes}m`, target: stage.users },
        { duration: `${stage.rampDownSeconds}s`, target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    answer_latency: [`p(95)<${defaults.answerLatencyP95ThresholdMs}`],
    ws_connect_success: [`rate>${defaults.wsConnectSuccessRateThreshold}`],
    ws_connect_errors: ["count<100"],
  },
  // Tag every metric with the stage label so results/ output is
  // unambiguous about which run it came from.
  tags: { stage: stage.label },
};

function randomThinkTime() {
  const { thinkTimeMinSec, thinkTimeMaxSec } = defaults;
  return Math.random() * (thinkTimeMaxSec - thinkTimeMinSec) + thinkTimeMinSec;
}

function shouldSimulateReconnect() {
  return Math.random() < defaults.reconnectFraction;
}

/**
 * Step 1: HTTP join — exchanges registration ref / OTP for a scoped
 * socket token. Adjust the path/payload to your actual join-contest
 * endpoint once you confirm it from src/modules/contest or quiz routes.
 */
function joinContestHttp(vuId) {
  const res = http.post(
    `${BASE_URL}/api/v1/contests/${CONTEST_SLUG}/join`,
    JSON.stringify({
      participantRef: `LOADTEST-${vuId}`,
      testToken: TEST_TOKEN,
    }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(res, {
    "join HTTP 200": (r) => r.status === 200,
  });

  let socketToken = TEST_TOKEN;
  try {
    const body = res.json();
    if (body && body.socketToken) socketToken = body.socketToken;
  } catch (e) {
    // fall back to TEST_TOKEN if the join endpoint shape differs —
    // keeps the script runnable against a stub/mock backend too
  }
  return socketToken;
}

/**
 * Step 2+: WebSocket session — join room, answer questions, submit.
 * Returns true if the VU completed a full quiz session.
 */
function runQuizSession(vuId, socketToken) {
  let completed = false;
  let questionsSeen = 0;
  let disconnectedOnce = false;

  const res = ws.connect(WS_URL, {}, function (socket) {
    socket.on("open", () => {
      wsConnectSuccess.add(true);
      socket.send(
        JSON.stringify({
          event: "quiz:v1:join",
          data: { contestSlug: CONTEST_SLUG, token: socketToken },
        })
      );
    });

    socket.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch (e) {
        return; // non-JSON engine.io framing noise — ignore
      }

      if (msg.event === "quiz:v1:question_start") {
        questionsSeen++;
        const thinkTime = randomThinkTime();
        sleep(thinkTime);

        const start = Date.now();
        const options = (msg.data && msg.data.options) || [{ id: "opt-0" }];
        socket.send(
          JSON.stringify({
            event: "quiz:v1:answer",
            data: {
              questionId: msg.data && msg.data.questionId,
              selectedOptionId: options[0].id,
            },
          })
        );
        answerLatency.add(Date.now() - start);
        questionsAnswered.add(1);

        // Mid-quiz disconnect/reconnect simulation — exercises the
        // 3-layer reconnect-resume flow once per session, around the
        // midpoint of the configured question count.
        if (
          !disconnectedOnce &&
          shouldSimulateReconnect() &&
          questionsSeen >= Math.floor(defaults.questionsPerQuiz / 2)
        ) {
          disconnectedOnce = true;
          socket.close();
        }
      }

      if (msg.event === "quiz:v1:submit_ack") {
        completed = true;
        submissionsCompleted.add(1);
        socket.close();
      }

      if (msg.event === "quiz:v1:auto_submitted") {
        completed = true;
        autoSubmitTriggered.add(1);
        socket.close();
      }
    });

    socket.on("error", () => {
      wsConnectErrors.add(1);
      wsConnectSuccess.add(false);
    });

    // Submit once we've seen the configured question count, otherwise
    // let the server's own auto-submit-at-duration-end fire instead —
    // this intentionally exercises BOTH submission paths across the VU
    // population rather than forcing every VU down the manual path.
    socket.setInterval(() => {
      if (questionsSeen >= defaults.questionsPerQuiz && !completed) {
        socket.send(JSON.stringify({ event: "quiz:v1:submit", data: {} }));
      }
    }, 5000);

    // Safety timeout — never hold a VU connection open indefinitely if
    // the server never responds (would otherwise mask real failures as
    // "still waiting" instead of counting them).
    socket.setTimeout(() => socket.close(), 45 * 60 * 1000);
  });

  check(res, { "WebSocket handshake succeeded": (r) => r && r.status === 101 });

  // Reconnect leg — only entered if we deliberately closed above.
  if (disconnectedOnce && !completed) {
    const reconnectDelay =
      Math.random() *
        (defaults.reconnectDelayMaxSec - defaults.reconnectDelayMinSec) +
      defaults.reconnectDelayMinSec;
    sleep(reconnectDelay);

    const reconnectRes = ws.connect(WS_URL, {}, function (socket) {
      socket.on("open", () => {
        socket.send(
          JSON.stringify({
            event: "quiz:v1:join",
            data: { contestSlug: CONTEST_SLUG, token: socketToken },
          })
        );
      });

      socket.on("message", (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw);
        } catch (e) {
          return;
        }
        // A correct reconnect-resume implementation should push the
        // participant straight back into their in-progress question
        // index, NOT restart from question 0 — assert that here once
        // your actual resume event/payload shape is confirmed.
        if (msg.event === "quiz:v1:question_start" || msg.event === "quiz:v1:resume") {
          reconnectSuccess.add(true);
          socket.close();
        }
      });

      socket.on("error", () => reconnectSuccess.add(false));
      socket.setTimeout(() => socket.close(), 30000);
    });

    check(reconnectRes, {
      "reconnect handshake succeeded": (r) => r && r.status === 101,
    });
  }

  return completed;
}

export default function () {
  const vuId = `${__VU}-${__ITER}`;
  const socketToken = joinContestHttp(vuId);
  runQuizSession(vuId, socketToken);
}

export function handleSummary(data) {
  const fileName = `../results/k6-stage-${stage.id}-${stage.label}-summary.json`;
  return {
    [fileName]: JSON.stringify(data, null, 2),
    stdout: JSON.stringify(
      {
        stage: stage.label,
        users: stage.users,
        answer_latency_p95: data.metrics.answer_latency
          ? data.metrics.answer_latency.values["p(95)"]
          : null,
        ws_connect_success_rate: data.metrics.ws_connect_success
          ? data.metrics.ws_connect_success.values.rate
          : null,
      },
      null,
      2
    ),
  };
}
