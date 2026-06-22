/**
 * QuizBuzz — Artillery processor functions
 *
 * Lightweight hooks only — NO business logic lives here per project rule
 * (business logic belongs in the backend's own service layer; this file
 * only records load-test metrics and simulates client timing/behavior).
 */

const reconnectFraction = Number(process.env.RECONNECT_FRACTION || "0.05");
const reconnectDelayMinSec = Number(process.env.RECONNECT_DELAY_MIN_SEC || "5");
const reconnectDelayMaxSec = Number(process.env.RECONNECT_DELAY_MAX_SEC || "15");

function beforeQuizSession(context, events, done) {
  context.vars.questionStartedAt = Date.now();
  context.vars.currentQuestionId = "q-placeholder"; // overwritten once a real
  // question_start payload is parsed — see note in README about wiring
  // Artillery's ws message capture to your actual event payload shape.
  return done();
}

function recordQuestionStartWait(context, events, done) {
  const waitMs = Date.now() - (context.vars.questionStartedAt || Date.now());
  events.emit("histogram", "quizbuzz.question_wait_ms", waitMs);
  return done();
}

function recordAnswerSent(context, events, done) {
  events.emit("counter", "quizbuzz.answers_sent", 1);
  context.vars.questionStartedAt = Date.now();
  return done();
}

function maybeSimulateReconnect(context, events, done) {
  if (Math.random() >= reconnectFraction) {
    return done();
  }

  events.emit("counter", "quizbuzz.reconnect_attempts", 1);
  const delaySec =
    Math.random() * (reconnectDelayMaxSec - reconnectDelayMinSec) +
    reconnectDelayMinSec;

  // Artillery's ws engine doesn't expose a clean "close + reopen mid-flow"
  // primitive inside a processor function the way k6 does — for the real
  // reconnect-resume assertion, rely on the k6 script (quiz-load-test.js)
  // as the source of truth for that specific behavior, and treat this
  // Artillery hook as a coarse cross-check that reconnect attempts under
  // load don't measurably raise the overall error rate.
  setTimeout(done, delaySec * 1000);
}

function recordSubmissionComplete(context, events, done) {
  events.emit("counter", "quizbuzz.submissions_completed", 1);
  return done();
}

module.exports = {
  beforeQuizSession,
  recordQuestionStartWait,
  recordAnswerSent,
  maybeSimulateReconnect,
  recordSubmissionComplete,
};
