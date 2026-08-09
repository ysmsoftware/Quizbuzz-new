# Contest-Start Reliability — Phased Feature Spec

**Status:** Draft for review
**Owner:** Austin
**Related incident:** "Two-Redis Trap" — `CONTEST_START` BullMQ job stranded in idle-mode Redis after a `go-live` switch, participants stuck in the waiting room, manual Redis CLI intervention required.

---

## 1. Problem Statement

A contest's start is currently driven by exactly one mechanism: a delayed BullMQ job (`start-${contestId}`) enqueued at publish time, consumed by `quiz-timer.worker.ts`. If that job is ever missing at fire time — Redis mode-switch data loss, a failed re-schedule, an operator error, a bug not yet discovered — there is no fallback. The only recovery path today is a human noticing participants stuck in the waiting room and manually enqueuing a job from a shell. That is not an acceptable failure mode for a contest a client is paying for and watching live.

`go-live.sh`/`go-idle.sh` already migrate Redis keys via `redis-migrate.js` before switching `REDIS_HOST`, and `quiz-timer.worker.ts` already has a staleness self-heal (`isDueOrReschedule`) that catches a job firing at the *wrong* time. Neither catches a job that is simply *absent*. This spec closes that gap in two phases.

## 2. Goals

- G1: An admin can manually start a contest with one click if the automated start fails to happen, with no shell/Redis access required.
- G2: The system detects and self-heals a missing `CONTEST_START` job automatically, without waiting for a human to notice.
- G3: Neither mechanism can cause a contest to start twice, start with corrupted state, or race against the scheduled job.
- G4: All new thresholds (visibility window, sweep interval, lookahead) are config-driven — no hardcoded values, per the project's existing config-agnostic rule.

## 3. Non-Goals

- Not building instance-level back-pressure/health-check changes (separate, already-scoped work from the load-testing session).
- Not changing the CPU-based ASG scaling trigger.
- Not building a general-purpose job-monitoring dashboard — Phase 2's audit trail is a byproduct, not the deliverable.
- Not solving the Route53 `already exists` Terraform issue — unrelated, tracked separately.

## 4. What Already Exists (do not rebuild)

| Mechanism | File | What it covers |
|---|---|---|
| Redis key migration on mode switch | `load-testing/scripts/redis-migrate.js`, wired into `terraform/environments/prod/go-live.sh` / `go-idle.sh` | Prevents job loss *during* a mode transition, by DUMP/RESTORE of all keys before the source Redis is repointed/destroyed |
| Staleness self-heal | `handleContestStart`/`handleAutoSubmit` in `backend/src/workers/quiz-timer.worker.ts`, via `isDueOrReschedule` | Catches a job that fires *too early* relative to the contest's current `startTime` (e.g. after a reschedule) and re-queues it |
| Idempotent job scheduling | `QuizSchedulerService.scheduleJob` in `backend/src/modules/quiz/quiz-scheduler.service.ts` | Evicts any existing job before re-adding, so reschedules don't collide with stale jobs |
| Recurring sweep pattern (template to copy) | `PaymentService.ensurePaymentCleanupRecurringJob` in `backend/src/modules/payment/payment.service.ts`, consumed by `backend/src/workers/payment-cleanup.worker.ts` | Proven BullMQ `repeat: { every }` pattern already running in production for abandoned-payment cleanup — Phase 2 copies this shape |
| Force-end pattern (template to copy) | Route `POST /:contestId/force-end` → `contest.controller.ts` → `ContestService.forceEndContest` → `ContestActionBar.tsx` | Exact structural template for Phase 1's manual start button |

None of these catch "the job is simply gone." That's the actual gap.

---

## 5. Phase 1 — Manual "Start Now" Override

### 5.1 Requirements

**P0**
- An admin viewing a contest in `REGISTRATION_CLOSED` (or `PUBLISHED`, if registration hasn't auto-closed) phase can manually trigger the start.
- The button becomes visible a configurable window before `startTime` — default **10 minutes**, config key `config.quiz.manualStartVisibilityWindow` (seconds/ms, env-driven, not hardcoded).
- A live countdown ("Starts in 04:32") renders next to/above the button once visible, ticking every second, same pattern as the existing participant-facing `WaitingRoomCountdown.tsx`.
- Clicking triggers a type-to-confirm dialog (mirroring `ContestActionBar`'s existing "END CONTEST" confirm pattern) before firing, since this is an irreversible, participant-facing action.
- The action is idempotent: if `status` is already `LIVE`, the endpoint rejects with a `ConflictError`, same shape as `forceEndContest`'s guard.
- Triggering a manual start **removes** the still-pending `start-${contestId}` BullMQ job so the scheduled job cannot also fire and double-run the start sequence.

**P1**
- Admin live-stats panel (wherever `admin:v1:live-stats` is currently surfaced) shows a visual "starting soon" state once inside the window, not just the button — e.g. a pulsing badge, so eyes are drawn to it without requiring the admin to be looking at the action bar specifically.
- Toast/notification if the automated job appears to have been skipped (i.e., window has closed, `now > startTime + grace`, still not `LIVE`) — a soft nudge before the admin would otherwise just be staring at a stuck waiting room.

**Explicitly deferred to Phase 2 or later**
- Automatic detection/self-heal — Phase 1 is human-triggered only.

### 5.2 Backend Design

`handleContestStart()` currently lives as a private function inside `quiz-timer.worker.ts`, closed over the late-bound `quizGateway`/`quizService`/`prisma` refs set by `injectTimerWorkerDeps`. To avoid duplicating that logic in a new controller path, extract the body (steps 1–5: status flip, `transitionToQuiz`, per-participant `handleRejoin` + `startQuizForParticipant`, DB-fallback sweep, admin broadcast) into a method on `ContestService` (or a new `ContestStartService` if `ContestService` is already large) that both the BullMQ processor and the new endpoint call. The worker's `handleContestStart` becomes a thin wrapper: staleness check → call shared method.

New route, same shape as force-end:

```
POST /:contestId/start-now
  authenticatedOrgMiddleware, idempotency
  → ContestController.startContestNow
  → ContestService.startContestNow(contestId, organizationId)
```

`ContestService.startContestNow`:
1. Load contest, 404 if missing.
2. Reject if `status === 'LIVE'` or any terminal status (`CANCELLED`, `COMPLETED`, `EVALUATION`, etc.) — mirror `forceEndContest`'s status guard, inverted.
3. Remove the pending `start-${contestId}` job via `quizTimerQueue.getJob()` + `.remove()` (same pattern already used in `QuizSchedulerService.cancelContestJobs`) — this is the step that prevents a double-fire race.
4. Call the shared start-sequence method (see above).
5. Return the same shape the worker logs: `{ status: 'LIVE', transitioned, blocked }`.

Zod schema: empty body or optional `{ reason?: string }`, `.strict()`, same as `ForceEndContestSchema`.

### 5.3 Frontend Design

`ContestActionBar.tsx`'s `renderRegistrationClosedActions()` gets a new conditional block:

```
const msUntilStart = new Date(contest.startTime).getTime() - now; // `now` from a 1s ticking state, same pattern as WaitingRoomCountdown
const showStartNow = msUntilStart <= MANUAL_START_VISIBILITY_WINDOW_MS && contest.status !== 'LIVE';
```

`MANUAL_START_VISIBILITY_WINDOW_MS` should come from a config/constants endpoint or be baked into the contest payload as `manualStartVisibleFrom` computed server-side (preferred — keeps the threshold config-driven from one place instead of duplicated in frontend code). Recommend the backend include this as a derived field on the contest response rather than the frontend hardcoding the window, so `config.quiz.manualStartVisibilityWindow` stays the single source of truth.

Countdown: a small wrapper around the same tick logic as `WaitingRoomCountdown.tsx` (already handles days/hours/min/sec, already used and battle-tested), sized down for the admin toolbar rather than the full-screen participant version.

`useContestLifecycle.ts` gets a new `useStartContestNow(contestId)` mutation hook, same shape as `useForceEndContest`.

### 5.4 Acceptance Criteria

- Given a contest in `REGISTRATION_CLOSED` with `startTime` 15 minutes away, when the admin loads the contest page, then no Start Now button is visible.
- Given the same contest with `startTime` 8 minutes away (inside the 10-minute default window), then the button and countdown are visible, ticking.
- Given the admin clicks Start Now and confirms, then the contest transitions to `LIVE`, waiting-room participants receive `quiz:v1:start`, and the pending `start-${contestId}` job no longer exists in the queue.
- Given the scheduled job somehow still fires after a manual start (race), then it no-ops cleanly (status is already `LIVE`, existing `CANCELLED`/`COMPLETED` guard pattern extended to also treat `LIVE` as a no-op for `CONTEST_START` specifically) rather than erroring or re-running the start sequence.
- Given a contest already `LIVE`, then `POST /:contestId/start-now` returns 409, and the frontend never renders the button for that phase.

### 5.5 Effort

Small. This is almost entirely reuse: existing force-end route/controller/schema/UI pattern, existing `WaitingRoomCountdown` tick logic, existing `handleContestStart` business logic (relocated, not rewritten). The only genuinely new logic is the visibility-window threshold and the pending-job cancellation on manual trigger. Estimate: 1–2 days including tests.

---

## 6. Phase 2 — BullMQ Reconciliation Sweep

### 6.1 Requirements

**P0**
- A recurring job scans for contests whose `CONTEST_START` job should exist but doesn't, and re-enqueues it.
- Runs as a BullMQ repeatable job (`repeat: { every: intervalMs }`), following `ensurePaymentCleanupRecurringJob`'s exact pattern — not an OS-level cron job, so it lives inside the always-on `worker` container (`restart: unless-stopped`, present in both idle and live compose files) and isn't tied to the ephemeral ASG fleet.
- Interval and lookahead window are config-driven: `config.quiz.reconciliationIntervalMs` (default 15 min, per your latest call — 15 or 30 both fine, 15 chosen as the default below) and `config.quiz.reconciliationLookaheadMs` (how far ahead to check — should be ≥ interval + safety margin, e.g. `intervalMs * 2`, so no contest can fall in a gap between two sweeps).
- Every detection-and-fix event is logged with enough detail to answer "how often does this actually fire in production."

**P1**
- Reuse the existing (currently unused) `ScheduledJob` Prisma model as an audit/observability log for what the sweep found and fixed (see §6.3) — not as the scheduling source of truth.

### 6.2 Job Design

New queue + worker, same shape as `payment-cleanup-queue`/`payment-cleanup.worker.ts`:

```
contest-reconciliation-queue → contest-reconciliation.worker.ts
```

`ContestService.ensureContestStartReconciliationJob()` (called once at worker boot, same as `ensurePaymentCleanupRecurringJob`):

```ts
await contestReconciliationQueue.add(
  "reconcile-contest-starts",
  {},
  {
    jobId: "periodic-contest-start-reconciliation",
    repeat: { every: config.quiz.reconciliationIntervalMs },
    removeOnComplete: true,
    removeOnFail: true,
  },
);
```

Processor logic each run:
1. Query `Contest` where `status IN ('PUBLISHED', 'REGISTRATION_CLOSED')` AND `startTime <= now + lookaheadMs` AND `startTime > now - graceMs` (small negative grace, e.g. 5 min, to also catch a job that should have fired recently and didn't — not just future ones).
2. For each candidate, `quizTimerQueue.getJob(`start-${contest.id}`)`. If missing (or present but its `delay`/target time is inconsistent with the contest's actual `startTime` — belt-and-suspenders alongside the worker's own `isDueOrReschedule`), re-enqueue via the same `QuizSchedulerService.scheduleJob`-style evict-then-add used everywhere else, so it can never collide with a job that's actually fine.
3. Log + (optionally) write a `ScheduledJob` row for each fix.

### 6.3 The Table Question — Deep Dive

You asked directly whether the reconciliation scan should hit `Contest` directly or go through a dedicated schedule table (`contestId`, `contestName`, `startTime`, `endTime`, one row per contest, added on create/reschedule, removed when done). Worth noting before anything else: **that table already exists in your schema and is currently unused.** `backend/prisma/schema.prisma` has a `ScheduledJob` model (`contestId`, `bullJobId`, `queue`, `name`, `payload`, `status`, `scheduledFor`, plus the relation already wired on `Contest.scheduledJobs`) — nothing in `backend/src` currently reads or writes it.

Per Austin: this table was deliberately designed, not accidental scaffolding — it was meant to back a general operational dashboard for monitoring/retrying background jobs across queues (certificate generation and message delivery already have admin-side retry UI; `ScheduledJob` was meant to extend that same visibility to the rest, including quiz-timer jobs) but got left unwired during initial build-out.

Given that, there are three real options:

**Option A — Query `Contest` directly.** `Contest` already has `@@index([startTime, status])` — precisely the composite index this scan needs. At your current and near-future scale (hundreds to low thousands of contests, not millions), a `WHERE status IN (...) AND startTime BETWEEN ...` against that index is a sub-millisecond index range scan regardless of sweep frequency. No new table, no dual-write, no drift risk between two copies of "when does this contest start." This is also what your own engineering guidelines already push toward — `Contest` is DB-level final truth, Redis/queues are runtime truth, and introducing a second persisted copy of the same scheduling fact is the kind of "mixing DB logic randomly" your rules explicitly warn against.

**Option B — A dedicated schedule-only table, built fresh.** Would need inserts on contest creation, updates on every reschedule, deletes on cancel/complete/delete — four more places that must stay in sync with `Contest`, in a codebase that has *already* been bitten once by two sources of truth silently diverging (that's the entire Two-Redis Trap). It buys narrower row width for the scan, which does not matter at this scale, at the cost of a new class of bug you've already lived through once.

**Option C — Repurpose the existing `ScheduledJob` table as an audit/observability log, not a query source.** The reconciliation sweep still queries `Contest` (Option A) to decide *what* to fix. But every time it detects and re-enqueues a missing job, it writes a `ScheduledJob` row (`contestId`, `bullJobId`, `queue: "quiz-timer"`, `name: "CONTEST_START"`, `status`, `scheduledFor`). This costs nothing extra architecturally — the table's already there, mapped, migrated — and gives you exactly the telemetry you'd want to answer your own question from the first discussion: *how often does this actually fire, and how much risk does it really remove.* After a month in production you'd have real numbers instead of an estimate.

**Recommendation: A for the scan, C for the audit trail — scoped narrowly for this spec.** Don't build a new table. Do wire up the one already sitting idle in your schema, but only as a write-once log of reconciliation events — never as something the scheduler reads from to decide what to do next. `Contest.startTime` stays the single fact the whole system agrees on.

This intentionally does **not** attempt the full original vision for `ScheduledJob` — a row for every quiz-timer job as it's scheduled/completed/failed, feeding a proper ops dashboard alongside the existing certificate/message retry UI. That's real, valuable work, but it's a separate, larger effort (it touches `QuizSchedulerService.scheduleJob` itself, not just the new reconciliation worker, and implies dashboard UI work on top). Decision made explicitly: keep this spec scoped to the reliability problem; treat full `ScheduledJob` wiring as its own future phase, see §8.

### 6.4 Frontend — 15-Minute Start-Time Slots

Confirmed per your latest instruction: 15-minute intervals (`:00`, `:15`, `:30`, `:45`), not 30. Implementation:

- Backend: extend `CreateContestSchema`/`RescheduleContestSchema` (`backend/src/modules/contest/contest.validator.ts`) with a `.refine()` checking `startTime.getMinutes() % config.contest.startTimeSlotMinutes === 0 && startTime.getSeconds() === 0`. `config.contest.startTimeSlotMinutes` (default `15`) — config-driven specifically so loosening it to 5 later, which you flagged as likely, is an env change, not a code change.
- This is the enforcement layer. The frontend widget is a UX nicety on top, not the source of truth — validate the same way server-side even if the picker only ever offers valid slots.
- Frontend: `RescheduleContestModal.tsx` and the contest-creation form currently use plain `<input type="datetime-local">`. Recommend replacing the time portion with a discrete slot picker (dropdown of `HH:MM` values stepped by the same config value) rather than relying on the native `step` attribute, which renders inconsistently across browsers and doesn't stop someone typing an off-grid value directly. Whatever the widget, the backend refine is what actually holds the line.
- Note this does **not** loosen the reconciliation sweep's query cost concern — as covered in §6.3, the indexed scan is cheap at your scale independent of whether start times land on a grid. The 15-minute restriction is worth doing for its own stated reason (reduce user mis-entry of odd start times), not as a prerequisite for Phase 2's performance.

### 6.5 Acceptance Criteria

- Given a contest whose `CONTEST_START` job was manually deleted from Redis (simulating the original incident), when the reconciliation sweep next runs (within `reconciliationIntervalMs`), then the job is re-enqueued with the correct remaining delay and the contest starts on time or with bounded lateness.
- Given a contest whose job is present and correctly scheduled, when the sweep runs, then it takes no action and writes no `ScheduledJob` audit row (only drift gets logged, not every healthy contest every cycle).
- Given an admin tries to create a contest with `startTime` at `14:07`, then the request is rejected with a clear validation error naming the allowed grid.
- Given the interval is changed via env var, then no code changes are required to take effect on next deploy.

### 6.6 Effort

Medium. The BullMQ repeatable-job scaffolding is a direct copy of the payment-cleanup pattern (low risk). The query and re-enqueue logic reuses `QuizSchedulerService`'s existing evict-then-add method. The `ScheduledJob` write path is new but trivial (single Prisma write). The frontend slot picker is the most open-ended part — a dropdown replacement for the datetime-local time input across two or three forms. Estimate: 3–4 days including the frontend picker and tests.

---

## 7. Sequencing

Phase 1 ships first and stands alone — it's the higher-value, lower-risk piece, and it's the fallback Phase 2 leans on if the sweep itself is ever the thing that's broken. Phase 2 depends on nothing from Phase 1 technically, but shipping second means there's already a manual escape hatch in production while the reconciliation worker gets its first real-world runs.

## 8. Open Questions

- **Engineering (blocking for Phase 1):** Should "Start Now" be clickable as soon as it's visible (up to 10 minutes *early*), or should it stay visible-but-disabled until the actual `startTime` passes, only becoming a true recovery action rather than an early-start convenience? Recommend defaulting to recovery-only (disabled until `startTime`, visible earlier purely so the admin isn't caught off guard) unless you specifically want early-start as a feature.
- **Engineering (non-blocking):** Should the reconciliation sweep also cover `AUTO_SUBMIT`/end-side jobs, or is this round scoped to start only? The queue/table design in §6 generalizes trivially to both if you want it now rather than as a fast-follow.
- **Product (non-blocking):** Final interval — 15 vs 30 minutes for the sweep itself (independent of the 15-minute start-time grid, which is already decided). 15 is used as the spec default; trivial to change via config either way.
- **Product (resolved, tracked for later):** Full `ScheduledJob` wiring — a row per quiz-timer job as it's scheduled/completed/failed, feeding a general ops dashboard alongside the existing certificate/message-delivery retry UI — was Austin's original intent for this table but is explicitly **out of scope for this spec** (decided during Phase 2 review). Revisit as its own phase once Phase 1/2 here are shipped; touches `QuizSchedulerService.scheduleJob` directly and implies new dashboard UI, so it deserves its own scoping pass rather than riding along with the reliability fix.
