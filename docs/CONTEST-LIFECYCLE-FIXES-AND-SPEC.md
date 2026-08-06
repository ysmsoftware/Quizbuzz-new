# QuizBuzz — Contest Lifecycle: Fixes & Specification

**Status:** Part A shipped · Part B open defects · Part C proposed build
**Last updated:** 2026-08-05
**Scope:** pre-quiz flow (join → system-check → waiting → play), contest scheduling, admin contest lifecycle operations

---

## Table of contents

1. [Part A — Fixes implemented](#part-a--fixes-implemented)
2. [Part B — Open defects found, not yet fixed](#part-b--open-defects-found-not-yet-fixed)
3. [Part C — Specification: Reschedule, Cancel, Force-End](#part-c--specification-reschedule-cancel-force-end)
4. [Notification policy matrix](#notification-policy-matrix)
5. [Status transition rules](#status-transition-rules)
6. [Implementation checklist](#implementation-checklist)

---

# Part A — Fixes implemented

Nine defects were found and fixed. Both `frontend` and `backend` typecheck clean (`tsc --noEmit`) after all changes.

---

### A1 · Participants pushed into the quiz before the scheduled start time

**Severity:** Critical — participants entered a live exam early with a wrong timer.

**Symptom.** Contest scheduled for 20:15. At 20:14 the participant opened the waiting room, saw the countdown briefly, and was immediately redirected into `/play`. The in-quiz timer showed more than the contest's 1-hour duration.

**Root cause — three independent defects stacked:**

**(a) Stale BullMQ job survived a schedule edit.**
`QuizSchedulerService.scheduleJob()` adds every lifecycle job with a fixed `jobId` (`start-${contestId}`). BullMQ treats `jobId` as an idempotency key — **`queue.add()` is a silent no-op when a job with that id already exists.** The reschedule path therefore depended entirely on `cancelContestJobs()` having removed the old job first, and that method wrapped removal in:

```ts
try { const job = await quizTimerQueue.getJob(jobId); if (job) await job.remove(); }
catch { /* Job may already have been processed — ignore */ }
```

Any removal failure was swallowed with no log. The original `CONTEST_START` job then survived **with its original delay**, the new `add()` was silently discarded, and the contest fired at the old time. `handleContestStart` flipped the contest to `LIVE`, and from that point `joinWaitingRoom()` returns `START_IMMEDIATELY`, which bypasses the waiting room by design. No error was raised anywhere in the sequence.

**(b) The waiting-room countdown used the browser clock.**
The quiz starts on the **server's** schedule, but `waiting/page.tsx` computed its countdown from `Date.now()` on the client. Any drift between the two clocks produced a countdown that disagreed with reality — the UI showed "1:00 remaining" while the server had already started. This did not *cause* the early start; it *hid* it.

**(c) ISR cache poisoned the fallback poll.**
`contestService.getContestBySlug()` used `next: { revalidate: 60 }`. The waiting room's "poll every 3s for `status === 'LIVE'`" fallback was therefore re-reading a response cached for up to a minute.

**Fix:**

| Layer | Change |
| --- | --- |
| `quiz-scheduler.service.ts` | `scheduleJob()` now explicitly evicts any pre-existing job before `add()`, so a new delay can never be discarded by the dedupe. |
| `quiz-scheduler.service.ts` | `cancelContestJobs()` no longer swallows removal failures — each is logged at `error` level with a summary warning. |
| `quiz-timer.worker.ts` | **Backstop:** new `isDueOrReschedule()` helper. `CONTEST_START` and `AUTO_SUBMIT` re-read the contest and compare against its **current** `startTime`/`endTime`. A job that woke early logs a `STALE` warning, re-queues itself for the correct moment, and does nothing else. `CONTEST_START` performs this check **before** flipping status to `LIVE`. |
| `contest.service.ts` | Public contest payload now returns `serverTime` (ISO). |
| `waiting/page.tsx` | Computes a round-trip-compensated clock offset from `serverTime` and runs every countdown against server time. |
| `contest-service.ts` | New `{ fresh: true }` option sets `cache: 'no-store'`; used by the waiting-room load and the status poll. |
| `config/index.ts`, `.env.example` | `QUIZ_TIMER_DRIFT_TOLERANCE` (default `5` seconds) — no magic numbers. |

**Problem solved.** The schedule is now self-healing regardless of queue state. A stale timer job reschedules itself instead of starting the contest early, schedule edits reliably take effect, and the waiting-room countdown agrees with the server.

---

### A2 · Quiz timer could exceed the contest's hard end time

**Severity:** High — participants cut off mid-quiz while their timer still showed time remaining.

**Root cause.** `QuizService.startQuiz()` set:

```ts
const totalTimeMs = (contest.duration ?? 60) * 60 * 1000;
```

A full fresh duration measured from the participant's own start, ignoring `contest.endTime`. Anyone starting even slightly off-schedule got a window that ran past `endTime` — at which point the `AUTO_SUBMIT` job force-submits them while the on-screen timer still shows time left.

**Fix.** Clamped to the contest's hard end:

```ts
const fullDurationMs   = (contest.duration ?? 60) * 60 * 1000;
const msUntilContestEnd = contest.endTime.getTime() - Date.now();
const totalTimeMs = Math.max(0, Math.min(fullDurationMs, msUntilContestEnd));
```

This matches what `handleRejoin()` already did, making start and rejoin consistent.

---

### A3 · `durationMinutes` silently stripped by Zod

**Severity:** High — silent data loss presented as success.

**Root cause.** `UpdateContestSchema = CreateContestBase.partial()`. Zod objects strip unknown keys by default. The admin overview page's inline "Contest Ends" editor posts `durationMinutes` (its client-side field name), but the schema only knows `duration`. The field was dropped, the request returned `200`, the UI toasted "Contest updated successfully!", and `duration`/`endTime` never changed — leaving `AUTO_SUBMIT` on the old schedule.

**Fix.** `UpdateContestSchema` now accepts `durationMinutes` as an explicit alias and normalises it onto `duration` via a transform.

> **Note:** this is the same class of bug as [B1](#b1--cancel-contest-is-completely-non-functional). Any client-side field name not present in `CreateContestBase` is silently discarded. See the [implementation checklist](#implementation-checklist) for the recommended systemic guard.

---

### A4 · Waiting room showed `—` for Questions and Total Marks

**Severity:** Medium — participants saw no exam metadata.

**Root cause.** Two separate gaps in `GET /contests/public/:slug`:

- `totalQuestions` was **never returned**. The frontend read `contest.totalQuestions`; the API only ever sent `_count.questions`. Pure field-name mismatch → `undefined` → `—`.
- `totalMarks` **did not exist anywhere** in the response. Marks live per-question on `ContestQuestion.marks` and were never aggregated for the public endpoint. This was missing data, not a naming issue.

**Fix.**
- `contest.repository.findBySlugPublic()` now selects each question's `marks`.
- `contest.service.getPublicContestBySlug()` sums them into `totalMarks`, exposes `totalQuestions` from `_count.questions`, and strips the raw per-question array before responding.
- `PublicContestDetail` type updated.

No change was needed in `waiting/page.tsx` — it was already reading the correct field names and simply never received data.

---

### A5 · Dead "Proceed to Quiz" button on the system-check screen

**Severity:** Medium — two competing CTAs, one a no-op.

**Root cause.** `CameraCheckWidget` ships its own "Proceed to Quiz" CTA. On `/system-check` its `onProceed` only called `updateCheckStatus(...)` — no navigation, no visible feedback. The screen's real action is the separate "Enter waiting room" button. Two buttons that both read as "move forward"; one did nothing.

**Fix.** Added a `showProceedButton` prop (defaults `true`). `/system-check` passes `false` — its own primary action owns the forward step. `/join` keeps it, since there it *is* the only forward action and its `onProceed` correctly navigates.

---

### A6 · Duplicate header on the waiting room

**Severity:** Low (cosmetic).

**Root cause.** `app/quiz/layout.tsx` excluded the generic `PublicHeader` only on `/play`. `/waiting` renders its own "secure portal" header, so both stacked at the same position with competing z-index.

**Fix.** Header-exclusion logic extended to `/waiting`.

---

### A7 · Black dead space at the bottom of the play screen

**Severity:** Medium — broken layout on large displays.

**Root cause.** The play page root had **both** `fixed` and `relative`:

```tsx
<div className="fixed inset-0 flex flex-col overflow-hidden bg-background text-foreground relative">
```

Tailwind emits `position:relative` **after** `position:fixed`, so `relative` silently won. `inset-0` stopped constraining the box, the container collapsed to content height, `flex-1` on `<main>` had no height to distribute, and the footer floated mid-screen with the body background showing beneath it.

**Fix.** Removed the stray `relative` — `fixed` already establishes the containing block the absolutely-positioned glow layers need. An explanatory comment prevents reintroduction. A codebase-wide sweep confirmed this was the only genuine `fixed`+`relative` collision (the camera feed's `lg:fixed` vs base `relative` is an intentional responsive swap that resolves correctly via media-query ordering).

---

### A8 · System-check page locked to a mobile-only width

**Severity:** Low — very tall single column on desktop.

**Root cause.** Wrapper pinned to `max-w-[440px]` at every breakpoint.

**Fix.** `lg:max-w-4xl`; on `lg+` the camera preview sits in a left column with the checklist, alerts and actions in a right column. Below `lg` — or when there is no camera preview (non-proctored contests) — it collapses to the original single column. The permissions troubleshooting guide was also moved **below** the action buttons so "Retest All Systems" / "Enter waiting room" are reachable without scrolling.

---

### A9 · Hardcoded navy/indigo/violet/orange palette across the app

**Severity:** Low — off-brand UI, broken light mode.

**Root cause.** `app/globals.css` defines the real design system (teal primary, amber accent, warm neutrals) as semantic tokens with light/dark variants. Large parts of the quiz flow ignored it and hardcoded a navy/indigo palette plus raw `rgba()` and hex literals that never adapt to light mode.

**Fix.** Converted to semantic tokens (`bg-background`, `bg-card`, `bg-primary`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-success`, `bg-warning`, `bg-destructive`, `chart-1..5`) across:

- **Quiz flow:** `join`, `waiting`, `play`, `QuestionCard`, `OptionButton`
- **`components/features/quiz/` (all 15):** `QuizTopBar`, `HintButton`, `QuestionNavigator`, `SubmitConfirmModal`, `FlagButton`, `SessionConflictPage`, `QuizSubmittingScreen`, `QuizRightPanel`, `WSConnectionStatus`, `QuizProgressStats`, `QuizProgressBar`, `QuizLoadingScreen`, `QuizCountdownDisplay`, `MobileQuizNavigatorSheet`, `AutoSubmitModal`, `WaitingRoomCountdown`
- **App-wide sweep:** `dashboard/certificates`, `org/contests/[id]/registrations`, `org/messages/templates`, `admin/question-bank-modal`, `live-monitor/LiveParticipantCard`, and the shared `date-picker` / `date-range-picker` primitives

`QuestionNavigator`'s inline-style colour logic was rewritten to emit Tailwind classes instead of raw hex/rgba, so it now follows light/dark mode. Two references to an undefined `bg-surface` / `bg-surface-2` class were also corrected.

**Verification.** A full grep for `indigo-`, `violet-`, and navy hex literals across `app/` and `components/` returns zero matches.

> **Deliberately not changed:** ~25 admin/org dashboard files still use raw `amber-*` Tailwind classes. Amber *is* the theme's correct accent/warning hue (`oklch(0.8 0.15 85)`), so these are the right colour written as a literal rather than as `text-warning`/`bg-accent`. Cosmetic consistency cleanup, not a bug.

---

# Part B — Open defects found, not yet fixed

These were discovered while tracing the lifecycle flow. **None are fixed.** All three are silent failures that report success to the admin.

---

### B1 · Cancel contest is completely non-functional

**Severity:** Critical — an admin believes a contest is cancelled when it is not.

**Evidence:**

| Check | Finding |
| --- | --- |
| Route | **No cancel route exists.** `contest.routes.ts` has no `POST /:contestId/cancel`. |
| Schema | `CancelContestSchema` is defined in `contest.validator.ts` and imported into `contest.controller.ts` — but **never used**. Grep count in the controller is `1` (the import line only). |
| Request path | `ContestActionBar` → `onCancel(reason)` → overview page → `updateMutation.mutateAsync({ status: 'CANCELLED', cancelReason })` → `PATCH /contests/:id`. |
| Validation | `UpdateContestSchema = CreateContestBase.partial()`. `CreateContestBase` contains **neither `status` nor `cancelReason`**. Zod strips both. |
| Outcome | `updateContest` runs with an effectively empty DTO, returns `200`. UI unconditionally toasts **"Contest has been cancelled"**. The contest is never cancelled, no participant is notified, no job is cancelled. |

The cancel modal also promises behaviour that does not exist anywhere in the codebase: *"Notify N participants via WhatsApp"* and *"Offer refunds to paid participants"*.

---

### B2 · "End Contest Now" is a UI-only stub

**Severity:** High — the designated escape hatch for a live contest does nothing.

`ContestActionBar.tsx` renders a full confirmation dialog with a typed `END CONTEST` guard. Its confirm handler is:

```tsx
onClick={() => {
  toast.info('Contest ending process started...');
  setConfirmText('');
}}
```

**No API call is made.** There is no `forceEnd`/`endContest` endpoint or service method anywhere in `backend/src`.

> **This directly affects the design decision in [Part C](#part-c--specification-reschedule-cancel-force-end).** The agreed rule is *"don't allow cancel during LIVE — the admin can force-end instead."* That rule is sound, **but force-end must actually be built**, otherwise a live contest has no admin control at all.

---

### B3 · Waiting room has no live update when the schedule changes

**Severity:** Medium — dead-end UX introduced by the reschedule feature.

Participants in the waiting room fetch the contest **once on mount**. If an admin reschedules while they are waiting, their client still holds the old `startTime`: the countdown runs to the old time, hits zero, begins polling for `LIVE`, and never receives it. They sit on a frozen `00:00:00` with no explanation.

**Two seams already exist to fix this:**
- `useWaitingRoomSocket` already returns a `contestStartTime` field — currently hardcoded to `null` with the comment *"startTime comes from the contest HTTP payload"*. A ready-made channel for pushing a revised start time.
- The waiting page already renders `BroadcastBanner`, fed by `quiz:v1:broadcast` with `info` / `warning` / `urgent` levels.

---

# Part B2 — App-wide sweep: other non-functional UI

After finding that cancel and force-end were stubs, the rest of the app was swept for
the same pattern — UI that reports success without doing anything. **None of the
below are fixed.** Ordered by severity.

### D1 · "Edit Details" modal saves nothing — `ContestActionBar.tsx:565`

`EditContestDetailsModal` collects a full form and calls `onSave(formData)`. The
handler passed to it is:

```tsx
onSave={async (updates) => {
  // Call the parent's onUpdate handler if available
  // For now, just show a success message
  toast.success('Contest details updated');
}}
```

The modal is reachable from **PUBLISHED, REGISTRATION_CLOSED and ENDED** action bars.
Every edit made through it is silently discarded. Same class as B1/B2.
**Fix:** wire `onSave` to the existing `useUpdateContest` mutation.

### D2 · Org analytics CSV export does nothing — `useOrgAnalytics.ts:31`

```ts
const exportCSV = () => { console.log('Exporting CSV...'); };
```

Bound to the "Export" button on `/org/analytics`. Note a working `downloadCsv()`
helper already exists in `app/org/contests/[id]/results/page.tsx` and should be
lifted to a shared util rather than reimplemented.

### D3 · Hardcoded `'org-1'` placeholder in 5 places

| File | Line |
| --- | --- |
| `app/org/messages/templates/page.tsx` | 19 |
| `app/org/contests/[id]/messages/page.tsx` | 39 |
| `app/org/analytics/page.tsx` | 19 |
| `components/features/messaging/SendMessageModal.tsx` | 68 |
| `components/features/messaging/TemplateBuilder.tsx` | 82 |

These pass a literal org id instead of the authenticated organization. In a
multi-tenant product this is both a correctness bug and a tenant-isolation smell —
whether it currently leaks depends on server-side scoping, which should be verified.

### D4 · Certificate share is a no-op — `app/dashboard/certificates/page.tsx:29`

`handleShare` toasts `Shared to {platform}` for LinkedIn / WhatsApp / copy without
doing anything. The adjacent `handleDownload` is correctly implemented.

### D5 · `onArchive` logs to console — `app/org/contests/[id]/index.tsx:190`

```tsx
onArchive={() => console.log('Archived')}
```

A working `archiveContest` API function already exists in `contests.api.ts`.

### D6 · "Opening Wizard..." toast — `app/org/contests/[id]/overview/page.tsx:324`

Button emits `toast.info("Opening Wizard...")` and opens nothing.

### Honestly labelled — not defects

Scheduled messaging (`ScheduleToggle.tsx`, `contests/[id]/messages/page.tsx`) is
explicitly marked "coming soon" in the UI. It promises nothing it doesn't deliver.

### Recommended follow-up

The recurring root cause is a handler prop wired to a toast during UI scaffolding and
never revisited. A lint rule banning handlers whose body is only a `toast.*` or
`console.log` call would catch the whole class going forward.

---

# Part C — Specification: Reschedule, Cancel, Force-End

## C0 · Design principles

**1. The endpoint is the intent.**
Notification is decided by *which operation was called*, never by diffing which fields changed. Field-diffing to decide "is this change material?" is ambiguous (a `duration` change is also an `endTime` change) and turns into a bug.

**2. Timing changes are atomic.**
Inline editing currently sends one field per request — `{ startTime }`, then `{ durationMinutes }`, then `{ registrationDeadline }` — each triggering its own full cancel-and-reschedule cycle, each validated against a half-updated contest. This is why `newRegDeadline >= newStartTime` can spuriously reject a valid final intent. Reschedule collapses this into **one validated payload → one write → one reschedule → one notification.**

**3. `LIVE` is a terminal state for schedule changes.**
No reschedule and no cancel once a contest is `LIVE`. This deliberately removes the riskiest code path entirely: no Redis session purge, no `LIVE → PUBLISHED` status regression, no deciding what happens to partial answers. Force-end is the single escape hatch.

---

## C1 · Reschedule Contest

### Endpoint

```
POST /contests/:contestId/reschedule
Headers: Idempotency-Key: <uuid>     # required — double-click must not double-notify
```

### Request

```jsonc
{
  "startTime": "2026-08-06T20:15:00.000Z",   // required
  "registrationDeadline": "2026-08-06T20:10:00.000Z", // optional; defaults to existing
  "duration": 60,                             // optional; minutes, defaults to existing
  "reason": "Venue network maintenance",      // optional; shown to participants
  "notifyParticipants": true                  // default true
}
```

`endTime` is always **derived** (`startTime + duration`) and never accepted from the client.

### Allowed statuses

| Status | Allowed | Rationale |
| --- | --- | --- |
| `DRAFT` | No | Use plain `PATCH` — no jobs scheduled, no registrants. |
| `PUBLISHED` | **Yes** | Primary case. |
| `REGISTRATION_CLOSED` | **Yes** | Registration is closed but the contest hasn't started. |
| `LIVE` | **No** | `409` — use force-end. |
| `EVALUATION` / `RESULTS_OUT` / `COMPLETED` / `CANCELLED` | No | `409`. |

Rescheduling is permitted right up to the moment the contest goes live — including one minute before.

### Validation

1. `startTime` must be in the future.
2. `registrationDeadline` < `startTime`.
3. `duration` within 10–480 minutes.
4. All three validated **together** against the final intended state, not incrementally.

### Service flow (`rescheduleContest`)

```
1. Load contest + assert status is PUBLISHED | REGISTRATION_CLOSED
2. Validate the complete new schedule
3. Persist { startTime, registrationDeadline, duration, endTime } in ONE write
4. schedulerService.cancelContestJobs(contestId)
5. schedulerService.scheduleContestLifecycle(contestId, orgId, newStart, newEnd, showResultsAfter)
6. Reschedule the 24h / 1h reminder jobs (reminder-24h-*, reminder-1h-*)
7. If notifyParticipants: enqueue bulk-notify with CONTEST_RESCHEDULED
8. Emit WS broadcast to room `contest:${contestId}`  → see C4
9. Write an audit record (who, when, old → new, reason)
```

Steps 4–5 already exist as reusable primitives. Step 6 currently lives inline in `updateContest` and should be lifted into the scheduler so there is one implementation.

### UI

- **New "Reschedule" button** in `ContestActionBar` for `PUBLISHED` / `REGISTRATION_CLOSED`.
- **Modal fields:** start date+time, registration deadline, duration, reason, "notify N registered participants" checkbox.
- **Live derived preview**, updating as the admin types:
  > *Starts in 2h 15m · ends 21:15 · registration closes 20:10 (Asia/Kolkata)*

  This directly targets the human error that started this investigation — a start time set one hour off, only noticed from the participant side.
- **Inline timing edits become gated:** for `DRAFT`, keep inline editing (harmless — no jobs, no registrants). For `PUBLISHED` and beyond, the timing fields on both the overview card and `KeyDatesCard` open the reschedule modal instead. Maps cleanly to the `isDraft` flag the page already computes. Non-timing fields (title, description, rules, `maxParticipants`) keep inline editing everywhere.

---

## C2 · Cancel Contest

Currently non-functional ([B1](#b1--cancel-contest-is-completely-non-functional)) — this is a build, not a patch.

### Endpoint

```
POST /contests/:contestId/cancel
Headers: Idempotency-Key: <uuid>
```

### Request

```jsonc
{
  "reason": "Unforeseen technical issues",  // required — shown to participants
  "notifyParticipants": true                 // default true; unconditional in practice
}
```

### Allowed statuses

| Status | Allowed | Rationale |
| --- | --- | --- |
| `DRAFT` | **Yes** | No notification sent (no registrants). |
| `PUBLISHED` | **Yes** | Notify all registrants. |
| `REGISTRATION_CLOSED` | **Yes** | Notify all registrants. |
| `LIVE` | **No** | `409`. **Use force-end** — participants mid-exam must have their answers preserved and submitted, not discarded. |
| `EVALUATION` / `RESULTS_OUT` / `COMPLETED` | No | `409`. |
| `CANCELLED` | Idempotent no-op | Return current state. |

### Service flow (`cancelContest`)

```
1. Load contest + assert status is DRAFT | PUBLISHED | REGISTRATION_CLOSED
2. Set status = CANCELLED, persist cancelReason + cancelledAt + cancelledBy
3. schedulerService.cancelContestJobs(contestId)
4. Remove reminder-24h-* / reminder-1h-* message jobs
5. If status was not DRAFT and notifyParticipants: bulk-notify CONTEST_CANCELLED
6. Emit WS broadcast to `contest:${contestId}` (urgent) → see C4
7. Audit record
```

### Required schema change

`CancelContestSchema` already exists and is unused. Wire it to the new route. **Do not** route cancel through `PATCH /contests/:id` — that is what caused B1.

> **Out of scope (explicitly deferred):** refunds for paid participants. The cancel modal currently promises *"Offer refunds to paid participants"* — that copy must be removed until a refund flow exists. Payment behaviour is unchanged in this work.

---

## C3 · Force-End Live Contest

Required, because it is the **only** admin control over a `LIVE` contest once cancel and reschedule are blocked. Currently a UI stub ([B2](#b2--end-contest-now-is-a-ui-only-stub)).

### Endpoint

```
POST /contests/:contestId/force-end
Headers: Idempotency-Key: <uuid>
```

### Request

```jsonc
{ "reason": "Widespread connectivity failure" }   // optional, audit + participant message
```

### Allowed statuses

| Status | Allowed |
| --- | --- |
| `LIVE` | **Yes** — the only valid state |
| everything else | `409` |

### Service flow

Force-end is **the existing `AUTO_SUBMIT` path, triggered on demand.** It should reuse `handleAutoSubmit`'s logic rather than reimplement it:

```
1. Assert status === LIVE
2. quizService.handleTimeExpiry(contestId)      // submits all active participants
3. gateway.emitAutoSubmit(pid, contestId, "force_ended") for each
4. contestService.triggerEvaluation(...)         // → EVALUATION
5. schedulerService.cancelContestJobs(contestId)  // drop the now-redundant AUTO_SUBMIT etc.
6. Enqueue MARK_ABSENT (same 10-min delay as the normal path)
7. Audit record
```

Participants' answers are **preserved and submitted** — this is the key difference from cancel and the reason cancel is blocked during `LIVE`.

The existing typed-`END CONTEST` confirmation in `ContestActionBar` is appropriate; it simply needs to be wired to this endpoint instead of a toast.

---

## C4 · Waiting-room live notification (WebSocket)

Fixes [B3](#b3--waiting-room-has-no-live-update-when-the-schedule-changes). Uses the **existing** participant socket infrastructure — no new namespace, no new connection.

### Mechanism

Reschedule and cancel emit to the room participants are already joined to (`contest:${contestId}`, joined in `handleJoin`):

```ts
// Reschedule
io.of('/participant').to(`contest:${contestId}`).emit('quiz:v1:rescheduled', {
  startTime: newStartTime.toISOString(),
  endTime:   newEndTime.toISOString(),
  reason,
  serverTime: new Date().toISOString(),
});

// Cancel
io.of('/participant').to(`contest:${contestId}`).emit('quiz:v1:cancelled', { reason });
```

Event names follow the existing `quiz:v1:*` versioned convention.

### Client handling — `useWaitingRoomSocket`

| Event | Behaviour |
| --- | --- |
| `quiz:v1:rescheduled` | Populate the already-present `contestStartTime` return value (currently hardcoded `null`) with the new time, and surface a `BroadcastMessage` of type `warning`: *"Contest rescheduled to 20:45"*. The waiting page's countdown effect already depends on `contestStartTime` and retargets automatically. Re-sync the clock offset from the included `serverTime`. |
| `quiz:v1:cancelled` | Emit an `urgent` `BroadcastMessage`, then redirect to a cancellation screen. |

**Why this is cheap:** `contestStartTime` is already threaded through the hook's return type and already consumed by the countdown (`const target = contestStartTime ?? new Date(contest.startTime)`). `BroadcastBanner` already renders on the waiting page with `info`/`warning`/`urgent` styling. Both seams exist; only the event handlers are new.

---

# Notification policy matrix

Notification is determined by **operation**, never by field diff.

| Operation | Endpoint | Bulk message | WS broadcast | Rationale |
| --- | --- | --- | --- | --- |
| **Reschedule** | `POST /:id/reschedule` | ✅ `CONTEST_RESCHEDULED` (opt-out) | ✅ `quiz:v1:rescheduled` | Changes when a participant must show up. Material. |
| **Cancel** | `POST /:id/cancel` | ✅ `CONTEST_CANCELLED` | ✅ `quiz:v1:cancelled` (urgent) | The event is not happening. Material. |
| **Force-end** | `POST /:id/force-end` | ❌ | ✅ existing `quiz:v1:auto_submit` | Participants are already in-app and see it immediately. |
| Title / description / rules / topics | `PATCH /:id` | ❌ | ❌ | Cosmetic. Reflected on next page load. |
| Question count / marks | `PATCH /:id` | ❌ | ❌ | Not participant-actionable pre-quiz. |
| `maxParticipants`, banner, prizes | `PATCH /:id` | ❌ | ❌ | Not participant-actionable. |
| Duration change on `DRAFT` | `PATCH /:id` | ❌ | ❌ | No registrants exist. |
| Duration change on `PUBLISHED`+ | **`POST /:id/reschedule`** | ✅ | ✅ | Must go through reschedule. "90 minutes, not 60" is material to someone who blocked an hour. |

### Consequence — timing fields are removed from `PATCH`

Once published, `PATCH /contests/:id` must **reject** `startTime`, `registrationDeadline`, `duration`, and `durationMinutes` with a `400` pointing at the reschedule endpoint. This is what makes the matrix enforceable rather than advisory, and it structurally prevents a timing change from ever bypassing notification.

### New message templates

| Template | Variables |
| --- | --- |
| `CONTEST_RESCHEDULED` | `contestTitle`, `oldStartTime`, `newStartTime`, `reason`, `joinUrl` |
| `CONTEST_CANCELLED` | `contestTitle`, `originalStartTime`, `reason` |

Both go through the existing `messageQueue` `bulk-notify` job — the same pipeline as the 24h/1h reminders. At 10k participants this inherits the message provider's rate limits; confirm headroom before a large contest.

---

# Status transition rules

```
                    ┌─────────┐
                    │  DRAFT  │──── cancel ──────────────┐
                    └────┬────┘                          │
                     publish                             │
                         ▼                               ▼
                  ┌─────────────┐                 ┌────────────┐
      ┌───────────│  PUBLISHED  │──── cancel ────►│ CANCELLED  │
      │           └──────┬──────┘                 └────────────┘
  reschedule             │                               ▲
      │        close-registration                        │
      └───────────►┌─────────────────────┐               │
      ┌────────────│ REGISTRATION_CLOSED │─── cancel ────┘
  reschedule       └──────────┬──────────┘
      └──────────────────────►│
                     CONTEST_START job
                              ▼
                        ┌──────────┐
                        │   LIVE   │   ✗ no reschedule
                        └────┬─────┘   ✗ no cancel
                             │         ✓ force-end only
              AUTO_SUBMIT / force-end
                             ▼
                      ┌─────────────┐
                      │ EVALUATION  │
                      └──────┬──────┘
                             ▼
                      ┌─────────────┐     ┌───────────┐
                      │ RESULTS_OUT │────►│ COMPLETED │
                      └─────────────┘     └───────────┘
```

**Invariants:**
- Reschedule: `PUBLISHED`, `REGISTRATION_CLOSED` only.
- Cancel: `DRAFT`, `PUBLISHED`, `REGISTRATION_CLOSED` only.
- Force-end: `LIVE` only.
- No path returns from `LIVE` to `PUBLISHED`. This is deliberate — it removes the need for Redis session purging and the entire class of "participant already pulled into the quiz" recovery logic.

> **Accepted residual risk:** if a contest ever does get stuck `LIVE` incorrectly, there is no in-product recovery — it is a manual DB/ops action. This is acceptable because the [A1](#a1--participants-pushed-into-the-quiz-before-the-scheduled-start-time) staleness guard means a stale timer job now reschedules itself instead of starting the contest.

---

# Implementation checklist

### Backend

- [ ] `POST /contests/:contestId/reschedule` — route, controller, `RescheduleContestSchema`
- [ ] `POST /contests/:contestId/cancel` — route, controller; wire the existing unused `CancelContestSchema`
- [ ] `POST /contests/:contestId/force-end` — route, controller
- [ ] `ContestService.rescheduleContest()` / `.cancelContest()` / `.forceEndContest()`
- [ ] Lift reminder-job (re)scheduling out of `updateContest` into `QuizSchedulerService` — single implementation
- [ ] Reject timing fields in `PATCH /contests/:id` once status is past `DRAFT`
- [ ] Message templates `CONTEST_RESCHEDULED`, `CONTEST_CANCELLED`
- [ ] WS emits `quiz:v1:rescheduled`, `quiz:v1:cancelled` to `contest:${contestId}`
- [ ] Apply `idempotency.middleware` to all three new endpoints
- [ ] Audit records (actor, timestamp, old → new, reason)
- [ ] **Systemic guard:** make `UpdateContestSchema` (and peers) `.strict()` so unknown keys throw `400` instead of being silently stripped. This is the root cause of both A3 and B1 and will recur otherwise.

### Frontend

- [ ] `RescheduleContestModal` with live derived schedule preview + timezone label
- [ ] Wire `ContestActionBar` cancel → new cancel endpoint (currently a silent no-op)
- [ ] Wire "End Contest Now" → force-end endpoint (currently a toast-only stub)
- [ ] Gate timing fields: inline edit on `DRAFT`, reschedule modal on `PUBLISHED`+
- [ ] `useWaitingRoomSocket`: handle `quiz:v1:rescheduled` / `quiz:v1:cancelled`; populate the existing `contestStartTime`
- [ ] Cancellation screen for participants in the waiting room
- [ ] Remove the cancel modal's unimplemented promises ("Offer refunds to paid participants", "Notify via WhatsApp") until those flows exist

### Verification

- [ ] Reschedule a `PUBLISHED` contest → confirm exactly one `CONTEST_START` job exists at the new delay
- [ ] Reschedule with a participant sitting in the waiting room → countdown retargets, banner appears
- [ ] Reschedule twice rapidly with the same `Idempotency-Key` → one notification
- [ ] Cancel a `PUBLISHED` contest → status actually changes, jobs removed, participants notified
- [ ] Attempt reschedule/cancel on `LIVE` → `409`
- [ ] Force-end a `LIVE` contest → all active participants submitted, answers preserved, status `EVALUATION`
- [ ] Confirm `PATCH` with `startTime` on a published contest → `400`

---

## Appendix — files touched in Part A

**Backend**
```
src/config/index.ts                              QUIZ_TIMER_DRIFT_TOLERANCE
src/modules/contest/contest.service.ts           totalMarks/totalQuestions, serverTime
src/modules/contest/contest.repository.ts        select question marks
src/modules/contest/contest.validator.ts         durationMinutes alias
src/modules/quiz/quiz.service.ts                 totalTimeMs clamp
src/modules/quiz/quiz-scheduler.service.ts       job eviction + failure logging
src/workers/quiz-timer.worker.ts                 isDueOrReschedule staleness guard
.env.example                                     QUIZ_TIMER_DRIFT_TOLERANCE
```

**Frontend**
```
app/quiz/layout.tsx                              header exclusion for /waiting
app/quiz/[slug]/waiting/page.tsx                 server clock anchor, fresh fetch, retheme
app/quiz/[slug]/play/page.tsx                    fixed/relative fix, retheme
app/quiz/[slug]/join/page.tsx                    retheme
app/quiz/[slug]/system-check/page.tsx            responsive 2-col, button order, proceed prop
components/features/proctoring/CameraCheckWidget.tsx   showProceedButton prop
components/features/quiz/*.tsx                   all 16 files rethemed
lib/services/contest-service.ts                  { fresh } no-store option
lib/types/public-contest.ts                      totalQuestions, totalMarks, serverTime
+ app-wide palette sweep (7 additional files)
```
