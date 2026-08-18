# Decisions & incident log

Working notes from one extended session across `Quizbuzz-new/backend` and
`quizbuzz-ops-next`. Written for the next agent (human or AI) picking this up
cold — every section states the problem, the evidence, the fix, and what's
still open. Update this file (don't replace it) as more of this class of
issue turns up; it's a running log, not a snapshot.

Companion file: `quizbuzz-ops-next/DECISIONS.md` covers ops-next-specific
items (its lint toolchain, the Next.js 16 upgrade specifics, the flag-sync
verification). This file owns everything cross-cutting.

---

## 1. Global audit trail (`AuditLog` / `logAudit()`)

Built a write-only audit trail for the main app, read cross-DB by ops-next,
mirroring the pattern ops-next's own `PlatformAuditLog` already used.

**Where it lives:**

- Schema: `prisma/schema.prisma` — `AuditLog` model, `AuditActorType` /
  `AuditTargetType` enums. No FKs on purpose (actor can be Admin or Contact;
  row must survive the actor being deleted later).
- Config: `src/config/audit-log.config.ts` — retention + metadata-truncation
  knobs only. Deliberately **not** wired to `.env`; edit the file directly.
- Context propagation: `src/common/audit-context.ts` (AsyncLocalStorage) +
  `src/common/audit-log.ts` (`logAudit()` — fire-and-forget Prisma insert,
  swallows its own errors, never throws, never awaited by callers). Wired
  into `app.ts` right after `addRequestId()`.
- Retention: `src/common/audit-retention.ts` + `src/workers/audit-retention-sweep.worker.ts`
  — daily batched DELETE, same BullMQ-repeatable-job pattern as
  `contest-reconciliation.worker.ts`.
- Job-boundary tracing: `requestId` is threaded through `EvaluationJobPayload`
  and `CertificateJobPayload`, set at enqueue time from `getAuditContext()`,
  and re-seeded into a fresh `AsyncLocalStorage.run()` at the top of each
  worker's processor (`evaluation.worker.ts`, `certificate.worker.ts`).
- Ops-side read: `quizbuzz-ops-next/server/features/audit-log-main-app/*`
  (new sibling module to the existing `audit-log` feature), reading this
  table cross-DB via the pre-existing `queryMainDb` pool — read-only, this
  app never has ops write to its own DB.

**Deliberately simplified from an earlier proposal:** the first draft of
this feature specified a Redis Stream buffer between the write path and a
batch-drain worker, to protect Redis memory and decouple the write from
Postgres. That's unnecessary complexity for what this actually needs — the
table lives in this app's *own* Postgres (not a foreign DB), and the CAP
posture already accepted eventual consistency / occasional data loss under
sustained outage. A fire-and-forget `prisma.auditLog.create().catch(...)`
gets the same "never blocks the hot path" guarantee with zero Redis usage,
zero consumer-group bookkeeping, and ~150 fewer lines. Don't re-add a
Redis-backed buffer here unless a real, measured problem (not a hypothetical
one) shows up — see the ponytail principle this session was run under: climb
the "does this need to exist at all" rung before reaching for infrastructure.

**Also simplified:** no new `ulid` dependency. Both repos already use ULID
as their id convention (`@default(ulid())` in Prisma for the main app;
`generateUlid()` from `server/utils/ulid.ts` in ops-next) — followed the
existing convention instead of introducing `crypto.randomUUID()`.

**Coverage — every `logAudit()` call site, by domain.** 28 distinct
`action` values across 30 call sites (two actions — `certificate.issue_triggered`
and `message.retried` — each have a single-item and a bulk variant; a third,
`submission.recovered`, was added by the durability work in §6). All
`Applied? Yes` rows are live in the codebase today, not aspirational; grep
`action: "` under `src/` to re-derive this table if it ever drifts.

| Domain | Action | Fires when | Applied? |
| --- | --- | --- | --- |
| Auth | • `auth.admin_login`<br>• `auth.admin_logout`<br>• `auth.admin_email_verified`<br>• `auth.participant_login` | • Admin successfully logs in<br>• Admin logs out (refresh token revoked)<br>• Admin verifies their email via OTP<br>• Participant authenticates into a contest | • Yes<br>• Yes<br>• Yes<br>• Yes |
| Organization | • `organization.created`<br>• `organization.member_invited`<br>• `organization.member_role_changed`<br>• `organization.member_removed` | • New org created (admin registration)<br>• Member invited to an org<br>• A member's role is changed<br>• A member is removed from an org | • Yes<br>• Yes<br>• Yes<br>• Yes |
| Contest | • `contest.created`<br>• `contest.published`<br>• `contest.cancelled`<br>• `contest.results_declared` | • New contest created<br>• Contest published (goes live for registration)<br>• Contest cancelled before it starts<br>• Results published for a contest | • Yes<br>• Yes<br>• Yes<br>• Yes |
| Participant | • `participant.disqualified` | • A participant is disqualified | • Yes |
| Payment | • `payment.captured`<br>• *refund issued* | • Razorpay webhook confirms a payment<br>• — | • Yes<br>• **No** — no refund feature exists in this codebase yet; don't log what doesn't exist |
| Payout | • `payout.route_transfer_processed`<br>• *route-transfer manual retry* | • A payout route-transfer succeeds<br>• — | • Yes<br>• **No** — `forceRetry` flag is fully plumbed but has zero live callers; no admin retry endpoint exists |
| Submission | • `submission.submitted`<br>• `submission.evaluated`<br>• `submission.invalidated`<br>• `submission.recovered` | • A submission is persisted<br>• A submission finishes evaluation<br>• Admin manually invalidates a submission<br>• A submission is rehydrated from the durability snapshot after live Redis session state was lost (`source=RECOVERED`) — see §6 | • Yes<br>• Yes<br>• Yes<br>• Yes |
| Certificate | • `certificate.issue_triggered`<br>• `certificate.generated`<br>• `certificate.failed`<br>• *delivered* | • Certificate generation queued (single **and** bulk-issue)<br>• Certificate PDF successfully generated<br>• Certificate generation fails<br>• — | • Yes<br>• Yes<br>• Yes<br>• **No** — `DELIVERED` exists in the `CertificateStatus` enum but nothing in this codebase ever transitions a cert to it; there's no delivery step to log |
| Question bank | • `question.bulk_imported` | • Bulk question import completes | • Yes |
| Messaging | • `message.sent`<br>• `message.retried`<br>• `message.failed` | • A queued message is sent successfully<br>• A failed message is retried (single **and** bulk retry-all)<br>• A message exhausts all send attempts | • Yes<br>• Yes<br>• Yes |
| System | • `system.contest_reconciliation_fired`<br>• `system.job_retries_exhausted` | • The recurring sweep actually re-enqueues a missing CONTEST_START job (no-op sweeps aren't logged)<br>• A BullMQ job (evaluation/submission/certificate) fails on its final retry attempt | • Yes<br>• Yes |

**Not yet instrumented, real gap (not "doesn't exist" like the rows
above):** org-lifecycle deletion/deactivation if one gets built, question
edit/delete (only bulk *import* is logged today), and any admin-facing
"manual retry" action that doesn't exist yet for route transfers. Add these
the same way — find the success point, call `logAudit()`, verify with
`tsc --noEmit`.

---

## 2. Dependency/tooling incidents

### 2a. `next lint` circular-JSON crash (ops-next)

Root cause: `next@15.5.20` paired with `eslint-config-next@16.2.12` — a full
major-version mismatch (someone bumped one without the other). `eslint-config-next@16`
ships flat-config-only plugin objects with a self-referential structure that
`next lint`'s legacy `.eslintrc.json` resolver can't JSON-serialize. Fixed by
pinning `eslint-config-next` back to the 15.x line. This was later
superseded by the full Next 16 upgrade (2b) — kept here because the
diagnostic method (checking `next`/`eslint-config-next` version pairing
first, before touching config) is the reusable lesson.

### 2b. Next.js 15 → 16 + nodemailer 6 → 9 (ops-next)

Both were CVE-driven major bumps (`npm audit` flagged real CVEs: SSRF in
Server Actions, unauthenticated disclosure of internal Server Function
endpoints, cache confusion, several nodemailer SMTP/header-injection CVEs).

Non-obvious parts of the Next 16 migration:

- **`middleware.ts` → `proxy.ts`.** Next 16 renamed the concept outright
  (function renamed `middleware` → `proxy` too). The official codemod
  (`npx @next/codemod@canary upgrade latest`) handles this correctly —
  verify the request-id-propagation logic came through byte-identical.
- **`next lint` is fully removed in 16**, not just deprecated. Migrate with
  `npx @next/codemod@canary next-lint-to-eslint-cli .` (needs `--force` on a
  dirty git tree — that's fine, it only edits a couple of config files, same
  as any other edit in an active session).
- **That second codemod bumped `eslint` to 10.x**, which immediately broke:
  `eslint-config-next`'s bundled `eslint-plugin-react@7.37.5` calls a
  context API ESLint 10 removed, and its own declared peer range only goes
  up to `^9.7`. Pin `eslint` back to `^9.39.x`.
- **The new bare `eslint .` command silently started linting the entire
  `server/` backend** — `next lint` never covered it (only `app/`,
  `components/`, `lib/`, `src/`, `pages/` by convention). Scope the new flat
  config's `files` array to match the old coverage, or you'll surface
  hundreds of pre-existing findings as a side effect of an unrelated
  dependency bump and make CI look newly broken.
- **The upgrade codemod pre-staged `export const instant = false` on every
  page**, anticipating Next 16's opt-in "Cache Components" feature — but
  that flag isn't enabled in `next.config.ts`, so it just breaks the build.
  Removed those exports rather than opting the whole app into a new caching
  model as a side effect of a security patch.
- **A new `react-hooks/set-state-in-effect` lint rule** shipped with the
  updated `eslint-plugin-react-hooks` and now flags 11 pre-existing call
  sites across the app (`setPage(1)` inside a filter-reset `useEffect` —
  used to reset pagination on filter change). Real fix is a small React
  refactor per site; left alone as out-of-scope for a dependency bump.
  Search for `set-state-in-effect` in a fresh `npx eslint .` run to find them.

### 2c. `dotenv`'s "vestauth" tip — investigated, not a security issue

`npx prisma generate` (and other npx invocations) print a rotating "tip"
line, one of which reads `⌁ auth for agents [www.vestauth.com]`. Traced to
`node_modules/dotenv/lib/main.js`'s hardcoded `TIPS` array — this is
`dotenv`'s own maintainer using the package's install base to advertise his
other project, same pattern as the `dotenvx.com` plugs already in that
array. Confirmed via the package's own `CHANGELOG.md`, and confirmed the
installed tarball's integrity hash matches the current npm registry exactly
(not a supply-chain-compromised install). Pure `console.log`, no network
call anywhere in the file. **Don't re-investigate this as a compromise** —
it's genuine (if obnoxious) upstream content.

### 2d. npm's native `approve-scripts` gate breaks `prisma generate` silently

npm 11's built-in install-script gate (not a project config — native to the
npm version) skips postinstall scripts for packages it doesn't have
pre-approved, including Prisma's, which normally auto-runs `prisma generate`
after `npm install`. A fresh `npm i` leaves `.prisma/client` stale/missing
(`Cannot find module '.prisma/client/default'`) until you either run
`npx prisma generate` manually or run `npm approve-scripts --allow-scripts-pending`
once to approve it going forward. `esbuild`/`sharp` are unaffected — their
native binaries ship as prebuilt platform packages, not via a gated
postinstall script.

---

## 3. BullMQ `jobId`-reuse dedup trap — the big one

**Symptom:** an admin retries something that already finished (a completed
*or* failed job) — status flips in the DB (e.g. certificate → `QUEUED`,
submission stays `SUBMITTED`), but the job never reaches a worker. No
worker log line, nothing in the queue. Silent, permanent stall.

**Root cause, verified against the actual BullMQ Lua scripts, not
guessed:** `certificateQueue.add(..., { jobId: cert.id })` (and similar
calls elsewhere) uses a stable, reusable ID as a "dedup key." But
`node_modules/bullmq/dist/cjs/commands/addStandardJob-9.lua`:

```lua
if rcall("EXISTS", jobIdKey) == 1 then
    return handleDuplicatedJob(jobIdKey, jobId, ...)
end
```

`handleDuplicatedJob.lua` just emits a `"duplicated"` event and returns —
**it never re-adds the job to the wait list**, regardless of whether the
existing job is active, completed, or failed. Since `defaultJobOptions` in
`src/queues/index.ts` uses count-based retention (`removeOnComplete: {count: 500}`,
`removeOnFail: {count: 2000}`) rather than immediate removal, a job's hash
sticks around long after it finishes — so any later `.add()` reusing that
same ID silently no-ops.

**The fix, applied everywhere this pattern was found vulnerable:** call
`queue.remove(jobId)` immediately before the `.add()` call that's meant to
re-trigger something. This is safe by construction —
`node_modules/bullmq/dist/cjs/commands/removeJob-2.lua` explicitly refuses
to remove a **locked** (actively-processing) job:

```lua
-- In order to be able to remove a job, it cannot be active.
if not isLocked(prefix, jobId, shouldRemoveChildren) then ... return 1 end
return 0
```

So a retry click while a job is genuinely mid-processing is still a safe
no-op (remove does nothing, the following add still collides and no-ops
too) — the "only one worker ever processes a given job" guarantee this
`jobId` scheme was originally built for is fully preserved. The fix only
ever succeeds in clearing a job that's already in a terminal state, which
is exactly when a legitimate retry needs to actually happen.

**Fixed:**

- `src/modules/certificate/certificate.service.ts` — `_enqueueGeneration`
  (covers single issue + single retry) and `retryFailedCertificates` (bulk
  retry).
- `src/modules/submission/submission.service.ts` — `triggerContestEvaluation`
  (bulk "reevaluate contest" — only affects submissions still `SUBMITTED`,
  i.e. ones whose first evaluation attempt failed and is stuck).
- `src/modules/payment/payment.service.ts` — `reconcileStuckTransfers`'s
  first loop (`missingPayments`). Worth noting: its *second* loop
  (`stuckTransfers`) already avoided this bug by not reusing a jobId at all
  — that fix predates this session and is direct evidence the team already
  hit and diagnosed this exact class of bug once before.
- `src/workers/evaluation.worker.ts` — the leaderboard-build trigger
  (`removeOnComplete: true` already covers the success path; only a prior
  *failed* build left a stale blocker).
- `src/modules/quiz/quiz-scheduler.service.ts` — `scheduleMarkAbsent`
  (shared by both the AUTO_SUBMIT path and admin force-end for the same
  contest — the second call could silently no-op).

**Already safe, confirmed by reasoning not just fixed-in-place:**

- `messaging.service.ts`'s retry paths use a timestamp-suffixed jobId per
  attempt (`retry-${id}-${Date.now()}`) — never collides.
- `quiz-scheduler.service.ts`'s `scheduleJob` (CONTEST_START/TIME_WARNING)
  and `quiz-timer.worker.ts`'s self-reschedule already use the identical
  get-then-remove-then-add pattern — this is where the team's *own* prior
  incident lives, referenced in a comment as *"the exact failure mode
  behind 'I moved the start time but the contest still began at the old
  time.'"* Read that comment before touching timer scheduling.
- All periodic/repeatable jobs (contest-reconciliation, payment-cleanup,
  analytics-snapshot, audit-retention-sweep) use `removeOnComplete: true, removeOnFail: true` (full removal, not retained) — never a stale hash to
  collide with. This is the right pattern for anything repeatable; don't use
  count-based retention (`{count: N}`) on a queue whose jobId is reused
  across scheduled runs.
- Every enqueue site with either no explicit `jobId` (BullMQ auto-generates
  a fresh one) or a jobId that's provably fresh every call (a new UUID, a
  freshly-created row's own id) is immune by construction — no fix needed,
  don't add one.
- Sites where the reused jobId **is** the desired behavior (preventing a
  double-submit race, preventing a duplicate participant notification on
  automatic BullMQ retry) were left alone — the "bug" there is the correct
  idempotency guard, not a bug.

**Checklist for auditing a new `.add()`/`.addBulk()` call site:**

1. Is the `jobId` stable/reused across more than one logical "please do this
   again" trigger (an explicit retry button, a recurring sweep re-touching
   the same entity, two independent code paths that can target the same
   entity)? If the jobId is either absent or provably fresh every call, stop
   here — it's safe.
2. If reused, is re-processing after a terminal state *desired* to be
   blocked (e.g. don't double-notify on an automatic in-job retry) or
   *undesired* (an explicit human retry action)? Only the second case needs
   the fix.
3. If it needs the fix: does the queue use `removeOnComplete: true, removeOnFail: true`? If so and the trigger only ever fires after success,
   you're already safe — no fix needed. If it uses count-based retention
   (the `defaultJobOptions` default) or `removeOnFail` retains failures,
   call `queue.remove(jobId)` immediately before the `.add()`.

---

## 4. Feature flags: two access models, not one

**Symptom:** `ambassador_program_enabled` toggled ON globally in ops (the
correct, intentional per-flag `defaultEnabled: false` had drifted to `true`
in the DB at some point) leaked the feature to *every* organization,
including ones with no explicit grant — the opposite of the intended
"available to specific orgs only" design.

**Root cause:** the single shared resolution function,
`computeEffectiveFlagState` (`src/common/effective-flag-state.ts`), only
ever implements one model: *"an active org override wins outright;
otherwise inherit the global value."* That's correct for flags meant to be
on-for-everyone-by-default (Razorpay, proctoring, certificate delivery,
analytics — override exists only to carve out an exception for one org),
but wrong for a flag meant to be off-by-default-and-opt-in-per-org
(ambassador). There was no code path that actually implemented the second
model — every flag used the same function regardless of which model it
conceptually needed.

**Fix:** added `computeOptInFlagState` alongside the original function,
with this truth table:

| global    | org override               | effective                                             |
| --------- | -------------------------- | ----------------------------------------------------- |
| `false` | any (even active `true`) | **off** — kill switch always wins              |
| `true`  | none                       | **off** — no silent inherit (this was the bug) |
| `true`  | `true`                   | on                                                    |
| `true`  | `false`                  | off                                                   |

`src/common/feature-flags.ts`'s `isFeatureEnabled()` picks between the two
via a small `OPT_IN_ONLY_FLAGS` set — currently just
`ambassador_program_enabled`. Every other flag's behavior is byte-identical
to before.

**Formalized in `quizzbuzz-ops-next/server/features/feature-flags/feature-flag-registry.ts`**
as an explicit `accessModel: 'GLOBAL' | 'OPT_IN'` field on every registry
entry, with a long doc comment explaining both models and pointing at this
incident. **When adding a new flag, `accessModel` is not optional metadata —
picking it wrong reproduces this exact bug.** If it's `'OPT_IN'`, you must
also add the key to `OPT_IN_ONLY_FLAGS` in this repo's `feature-flags.ts` —
the registry can't enforce that from ops-next's side; it's a different
deployment.

**Explicitly not done, flagged as a real follow-up:** `accessModel` only
exists in the TypeScript registry right now — it isn't synced into the
`FeatureFlag` DB row, exposed in the ops API response, or shown in the
Feature Flags UI (unlike `label`/`description`/`severity`/`supportsOrgOverride`,
which `sync-feature-flags.ts` already syncs on every boot). An ops admin
reading the dashboard currently has no way to tell which model a flag uses
without reading source. Wiring that through (migration + `sync-feature-flags.ts`

+ `feature-flags.types.ts`/`toFlagDetail` + a UI badge) is a reasonable,
  contained follow-up — ask before doing it, since it's a schema change.

**Also worth someone's attention, not fixed:** the ops→main-app sync
(`syncFlagToMainApp`/`syncOrgOverrideToMainApp` in ops-next's
`feature-flags.repository.ts`) is fire-and-forget with only a
`console.error` on failure — no retry, no visible failure signal in the UI.
In this dev environment `MAIN_DATABASE_URL` uses the Postgres superuser so
writes always succeed, but the schema's own *default* connection string is
scoped to a read-only `quizbuzz_ops_reader` role — if production is ever
configured with a role that restricted, every flag toggle would appear to
succeed in ops while silently never reaching the main app. Worth hardening
(surface the failure in the UI, or retry) before it's needed under
pressure.

---

## 5. Ambassador campaign reward-config unit: rupees (API) vs paise (DB)

**Symptom:** the campaign-creation wizard asked admins to type reward
amounts directly in paise (e.g. "Amount / Registration (paise)") —
confusing for anyone not mentally dividing by 100, and every dashboard/report
number was silently 100x too small once the display formatters were fixed to
stop double-dividing.

**Fix:** storage stays paise (integer, smallest currency unit — correct,
no schema/migration change) but the API contract is now rupees end to end:

- **Request side** (`POST /campaigns`, `PATCH /campaigns/:id`) — the
  frontend sends `rewardConfig` amounts in rupees; `ambassador-campaign.service.ts`
  runs `rewardConfigRupeesToPaise()` (new file: `reward-config-currency.ts`)
  before handing the JSON blob to the repo. Rupees→paise rounds to the
  nearest whole paisa (`Math.round(rupees * 100)`) — paisa can't be
  fractional, this is the correct rounding point, not a precision loss.
- **Response side** (every GET/create/update/publish/duplicate/template/stats/report/leaderboard
  endpoint touching `rewardConfig`, `accruedAmount`, `totalAccruedAmount`, or
  a leaderboard `prize`) — converted back to rupees via
  `rewardConfigPaiseToRupees()` / `campaignStatsPaiseToRupees()` /
  `leaderboardEntryPaiseToRupees()`, same file. paisa→rupees divides exactly
  (paisa is the smallest unit, so `paisa/100` always has ≤2 decimal places)
  and is rounded to 2dp purely to clear binary float noise
  (`100.30000000000001`), not because any precision is being discarded.
- Both directions live in `backend/src/utils/currency.ts`
  (`convertMinorUnitToMajor`/`convertMajorUnitToMinor`, INR-fixed wrappers
  `paisaToRupees`/`rupeesToPaisa`) — this utility already existed
  (`convertMinorUnitToMajor`/`paisaToRupees`) but had zero callers before
  this change; reused rather than duplicated.
- **Correctness trap avoided:** `reward-calculator.ts`'s `computeSpeedBonus`
  and `campaign-stats.ts`'s `findPrizeForRank` return object *references*
  straight into the campaign's stored `rewardConfig` (reused across every
  ambassador in a report/stats loop). The paise→rupees conversion always
  builds new objects (`reward-config-currency.ts`), never mutates in place —
  an in-place divide would have corrupted the number for every ambassador
  computed after the first one in the same request.
- **Dropped, not renamed:** `RewardConfig.amountsInPaise: true` — a literal
  contract field the frontend used to send/receive on create/update/publish.
  Once the contract is rupees, asserting "amounts are in paise" is backwards;
  it carried no runtime validation weight (never read outside its own Zod
  literal check), so it was removed from both `ambassador-campaign.types.ts`/
  `.validator.ts` and the frontend's mirrors (`lib/types/ambassador.ts`,
  `campaign-schema.ts`, `wizard-types.ts`'s `EMPTY_DRAFT`) rather than
  flipped to a new value.
- **No Prisma migration.** `AmbassadorCampaign.rewardConfig` /
  `AmbassadorCampaignTemplate.rewardConfig` are `Json` columns, not typed
  Int columns — JSON already stores a rupee float (e.g. `100.5`) losslessly,
  so there was no scalar column type to change. (The schema *does* have
  real `Int` money columns — `Payment.amount`, `PaymentConfig.amount`,
  `PaymentRouteTransfer.*` — but those belong to the unrelated contest-payment
  feature and were deliberately left untouched; don't fold them into this
  change without a separate, explicit decision.)

---

## 6. Redis durability for live quiz sessions: snapshot + recovery, HA replication, and a chaos-testing harness

**Problem.** During a live quiz, everything between join and submit
(session phase, answers, heartbeat, question order, violations) lives
*only* in Redis (`quiz:{contestId}:*` keys — see `quiz.session.ts`). Nothing
is written to Postgres until `submitQuiz()` enqueues a submission job. Before
this work, a Redis failure mid-contest meant total loss of every
in-progress participant's answers, with no recovery path at all — verified
against the actual pre-existing code, not assumed. Terraform also had
`automatic_failover_enabled = false`, `num_cache_clusters = 1` on the live
`cache.t4g.micro` ElastiCache node (`terraform/modules/live_contest/elasticache.tf`)
— a single point of failure with no replica, deliberately cost-optimized
down from the `DEPLOYMENT_PLAN.md` design's original `r6g.large` two-node
setup, but never restored after the cost-cutting pass.

**Decision: periodic BullMQ snapshot job, not a cron job, not a synchronous
write-through-with-fallback on every answer.** Three options were
evaluated:

- **Plain OS cron** — rejected outright, per the project's own hard rule
  against out-of-band scheduling (everything periodic in this codebase is a
  BullMQ repeatable job so it scales/monitors the same way as every other
  worker — see `contest-reconciliation.worker.ts`, `payment-cleanup.worker.ts`).
- **Synchronous write-through-with-fallback** (try Redis first on every
  answer save, fall back to a direct DB write on failure) — considered and
  rejected. `saveAnswer()` is on the hottest path in the system (every
  keystroke-equivalent event, for up to 10,000 concurrent participants per
  `LOAD_TEST_PLAN.md`'s ceiling stage); adding a synchronous Postgres
  fallback to *every* answer write means every answer either pays Redis
  latency (fine) or, on any Redis hiccup, blocks on a Postgres round-trip
  on the request path — trading a rare full-outage risk for a permanent
  tail-latency risk on the normal path. Not worth it when a periodic
  snapshot bounds the same risk to a small, known window.
- **Periodic BullMQ repeatable snapshot job (chosen).** Every
  `DURABILITY_SNAPSHOT_INTERVAL_MINUTES` (config-driven, default 5), a
  worker sweeps every live contest's participants and writes their current
  Redis state to a new `ParticipantProgressSnapshot` table. Answers in
  progress between snapshots are still exposed to loss, but that window is
  now minutes, not "the entire contest," and it costs zero added latency on
  the live answer-save path.

**What this gained:** bounded, known data-loss window (≤1 snapshot
interval) instead of unbounded loss, achieved with zero hot-path latency
cost and using a pattern (`ensureRecurringJob` — jobId dedup, remove-then-
re-add on worker boot) already proven safe in this exact codebase — see §3's
"already safe" list, which names this identical pattern in
`analytics.worker.ts` and `quiz-timer.worker.ts`'s self-reschedule. Not a
new risk class, a reused one.

**Where it lives:**

- Schema: `prisma/schema.prisma` — `ParticipantProgressSnapshot` model,
  unique index on `participantId` (one snapshot row per participant, upserted
  in place — not an append-only history table), indexes on `contestId` /
  `organizationId`, FK to `organizations` with `ON DELETE CASCADE`.
- Config: `DURABILITY_SNAPSHOT_INTERVAL_MINUTES`,
  `DURABILITY_SNAPSHOT_BATCH_SIZE` (default 300),
  `DURABILITY_SNAPSHOT_BATCH_CONCURRENCY` (default 4) — all in `.env` /
  `src/config/index.ts` under `config.durability`, per the project's own
  "no hardcoded limits" rule (`system-architecture-design.md` guideline §2).
- Read path (Redis → snapshot worker): `quiz.session.ts`'s
  `getManyParticipantSnapshots()` — one pipelined multi-participant read
  per batch, same batching shape as `seed-load-test-data.js`'s 500-record
  batches, chosen specifically to avoid reproducing incident #18 (DB pool
  exhaustion during a mass participant-login burst, originally fixed by
  raising `DB_POOL_MAX` 5→20 — see `quizbuzz-load-test-incident-log.md`).
  Unbounded per-participant queries during a sweep across thousands of live
  participants would risk the same exhaustion; batching with a config-driven
  concurrency cap avoids it by construction.
- Write path (snapshot → DB): `durability.service.ts` / `durability.repository.ts`
  — bulk raw-SQL `INSERT ... ON CONFLICT ("participantId") DO UPDATE` via
  `Prisma.sql`/`Prisma.join`, using `ulidx` for manual id generation since
  raw SQL bypasses Prisma's `@default(ulid())`.
- Worker: `src/workers/progress-snapshot.worker.ts`, `concurrency: 1`,
  registered in `src/workers/index.ts`. New queue: `progressSnapshotQueue`
  in `src/queues/index.ts`.
- Recovery path: `durability.service.ts#rehydrateParticipant()`, called from
  `quiz.service.ts#doSubmitQuiz()` when `getSession()` returns null (Redis
  state is gone) — rebuilds the submission payload from the last snapshot
  instead of falling back to a hardcoded zero-answer result.

---

**Decision: dynamic session TTL, not a static `QUIZ_SESSION_TTL` env
value — flagged, not yet implemented.** `createSession()` sets a single
fixed TTL (`config.redis.ttl.quizSession`, a static env value) on every
participant's session hash. `contest.validator.ts` allows contest
`duration` up to 480 minutes (8 hours). If the static TTL is set below a
given contest's actual duration + buffer, Redis will expire and silently
wipe that contest's live sessions mid-quiz — a bug, not a durability
trade-off. The fix (compute TTL per-contest from `startTime`/`endTime` +
a fixed buffer, at `createSession()` time, instead of one global constant)
was diagnosed and agreed on, but **is not yet implemented in code** — it
was out of scope for the two-phase implementation plan that was actually
executed (which covered the snapshot/recovery and duplicate-submission work
below). Anyone picking this up: the fix point is `createSession()`'s call
to `redis.expire()`, and the value should come from the same
`contestEndTime` already threaded through `QuizSessionState`.

---

**Decision: restore ElastiCache HA (`num_cache_clusters=2`,
`automatic_failover_enabled=true`, `multi_az_enabled=true`), scoped to
live-mode-only cost.** These flags were present in the original
`DEPLOYMENT_PLAN.md` design, removed during a cost-cutting pass for testing,
and never restored. Real-world ElastiCache failover (not the AWS-marketing
"under a minute" figure) was researched and caveated before this decision —
detection + promotion + client reconnect realistically lands in the
tens-of-seconds range, not sub-minute in the best case, though this
project's own `ioredis` `retryStrategy` (`Math.min(times*50, 2000)`,
capped 2s backoff) already tolerates a gap that size without the
application crashing. **Why restore now, applied manually by the repo
owner rather than in code:** it's a `terraform apply` on the *live-mode*
resource group only (`terraform/modules/live_contest/elasticache.tf`), zero
application code changes required, and cost only accrues while a contest
is actually live — the idle-mode single-node config is untouched. **What
this gained:** the snapshot/recovery mechanism above protects against
*application-level* session loss (crash, bad deploy, eviction under memory
pressure); replica + automatic failover protects against *infrastructure*
loss (node/AZ failure) without waiting for the next snapshot interval or
losing in-flight submissions currently mid-flight through BullMQ on the
same Redis. The two mechanisms cover different failure classes — this was
the reasoning for keeping both rather than treating either as sufficient
on its own.

---

**Decision: `lock:submission:{contestId}:{participantId}` as a Redis
mutex around `submitQuiz()`, not a hard "reject the second submit"
error.** The project's own engineering guidelines (`system-architecture-design.md`
§12, Concurrency Control) already specified this exact lock key pattern as
a requirement — it had never actually been implemented. Two ways this class
of bug can surface here: (1) the periodic snapshot and a live AUTO_SUBMIT
racing on the same participant, (2) a genuine concurrent double-submit
(reconnect + auto-submit-on-timeout firing close together). **Decision:**
`quiz.session.ts#acquireSubmissionLock()` (`SET key val PX ttl NX` — atomic,
no separate check-then-set race) gates the actual submit logic
(`doSubmitQuiz()`); a caller that loses the lock race doesn't error out —
it polls `waitForInFlightSubmission()` for the winner's result instead.
**The lock is a fast-path optimization, not the actual correctness
guarantee** — that's `Submission.participantId`'s DB-level `@unique`
constraint, backstopped in `submission.service.ts#persistSubmission()` by
catching Prisma's `P2002` (unique-violation) error and falling back to
`findByParticipantId()` for the already-committed row. **Why layer both:**
the Redis lock avoids wasted work (two full submission pipelines running
concurrently for nothing) in the common case; the DB constraint is what
actually prevents a duplicate row from ever landing, even in the rare case
where the lock itself is lost to a Redis failure between acquire and
release. **What this gained:** the one open concurrency gap named in the
project's own guidelines is now closed, and it's closed at the layer
(Postgres) that can't be raced around, not just at the layer (Redis) that
can.

**Bug found and fixed — `waitForInFlightSubmission()` gave up after one
miss.** The version delivered by the implementation pass checked
`isSubmissionLocked()` and `break`-ed out of its retry loop the moment the
lock cleared, before checking whether the winning caller's DB write had
actually landed yet — since the lock releases right after the BullMQ
enqueue, well before the async submission worker persists the row, this
meant the *losing* caller in a concurrent-submit race almost always got
told `{attempted: 0, totalQuestions: 0}` even though the real submission
was seconds away from succeeding. Not data corruption (the DB still ends
up with exactly one correct row, per the constraint above) but a real
user-facing correctness bug — a participant could be shown "0 answered"
for a quiz they actually completed. **Fixed** in `quiz.service.ts`: the
method now polls `prisma.submission.findUnique({ where: { participantId } })`
on every one of its 4 attempts (400ms apart) and only falls back to the
zero-answer result once every attempt is exhausted. Covered by
`quiz.service.durability-fixes.test.ts` (asserts `findUnique` is called 3
times before the real row is returned on the 3rd call, and 4 times before
the timeout fallback fires when the row never appears).

**Bug found and fixed — recovered `timeTakenSecs` overstated elapsed
time.** The `RECOVERED` branch computed `Date.now() - startedAt`, identical
to the live-submission formula — but recovery can run arbitrarily later
than when a participant's session actually went missing (e.g. a delayed
reconciliation sweep), so this could count the entire outage/recovery-delay
window as quiz-taking time. That value feeds `LeaderboardEntry.timeTakenSecs`
directly, so an unrelated recovery delay could have inflated (or, on a
speed-ranked leaderboard, unfairly penalized) a participant's rank. **Fixed:**
`contestEndTime` was added to `RehydrateResult` / `rehydrateParticipant()`'s
return, and the recovered-branch calculation now anchors to
`Math.min(Date.now(), contestEndTime)` with a `Math.max(0, ...)` floor,
falling back to plain `Date.now()` only when `contestEndTime` is unknown.
Covered by two tests: a 1-hour contest recovered 4 hours after
`contestEndTime` reports exactly 3600s (not 18000s); the `Date.now()`
fallback is separately verified when `contestEndTime` is null.

---

**Decision: explicit transaction timeouts on submission-persisting
transactions, config-driven.** Raised specifically because "the database
can legitimately take a few seconds to write under load" is a different
failure mode than "the database connection is down," and Prisma's default
`$transaction()` timeout (5s) doesn't distinguish them — a slow-but-healthy
write during a load spike could get killed and misread as a hard failure.
**Fixed:** both `$transaction()` calls in `submission.repository.ts`
(`createWithAnswers()`, `applyEvaluationResult()`) now pass explicit
`{ maxWait: config.database.transactionMaxWaitMs, timeout: config.database.transactionTimeoutMs }`,
sourced from `DB_TRANSACTION_MAX_WAIT_MS` / `DB_TRANSACTION_TIMEOUT_MS`
(defaults 5000/10000) instead of Prisma's silent built-in default — so the
actual tolerance is a visible, tunable number instead of an implicit
library default nobody had decided on.

---

**Decision: extend `SubmissionSource` with `RECOVERED` rather than
collapsing it into `AUTO`.** `"MANUAL" | "AUTO"` became
`"MANUAL" | "AUTO" | "RECOVERED"` in `submission.types.ts`. **Why:** a
submission that came from live Redis state (`AUTO`/`MANUAL`) and one
rehydrated from a snapshot after Redis loss are operationally different
events — an admin looking at the submissions table, or anyone querying
`Submission.source` for an incident retro, needs to be able to tell "the
durability path actually engaged for this participant" apart from the
normal path. **What this gained:** the recovery mechanism is observable
after the fact, not just functionally correct — paired with the new
`submission.recovered` audit-log action (§1) and `verify-chaos-recovery.js`
below, which both depend on this field existing and being distinct from
`AUTO`.

---

**Decision: build a chaos-testing harness (`chaos-redis-wipe.js` +
`verify-chaos-recovery.js`), kept explicitly outside the automated
capacity-gated load-test flow.** The two-phase implementation above was
verified with Jest (mocked Redis/DB/queues — proves the logic is correct
in isolation) and with a manual local repro (proves the fix works against
a real dev DB). Neither proves the recovery path holds up under thousands
of real concurrent participants, which is the actual production risk
scenario. **Considered:** folding a Redis-failure scenario directly into
`run-stage.sh`'s stages. **Rejected:** `run-stage.sh`'s gate criteria
(k6's `answerLatencyP95ThresholdMs`/`wsConnectSuccessRateThreshold`
thresholds, ASG instance-count band) exist to answer "does this many users
need this many instances, cleanly" — injecting a deliberate Redis failure
mid-stage would spike those numbers for reasons that have nothing to do
with capacity, and `run-all-stages.sh` would read that as "gate failed, stop
scaling," corrupting the very signal the staged progression exists to
produce. **Decision:** two new, separately-invoked scripts in
`load-testing/scripts/`, dry-run-by-default with an `--execute` flag —
the same safety convention `redis-migrate.js` already established in this
codebase, reused rather than reinvented:

- `chaos-redis-wipe.js` — samples a configurable percentage of a contest's
  `active`-set participants and deletes their 8 per-participant session
  keys plus their set membership, matching what a real Redis data-loss
  event would actually erase. Deliberately never touches `bull:*` job data,
  `leaderboard:*`, or the submission lock key — those belong to the
  HA/replication failure mode above, not this one; blending the two would
  make a failed run ambiguous about which mechanism actually broke. Writes
  a manifest (`results/chaos-manifest-*.json`) of exactly which
  participants were wiped.
- `verify-chaos-recovery.js` — reads that manifest and queries
  `Submission` for every wiped participant, reporting counts by `source`
  and failing (exit 1) if any wiped participant has no submission row at
  all. This — not k6's latency thresholds — is the actual pass/fail gate
  for a chaos run.

**What this gained:** a repeatable, low-ceremony way to validate the
recovery path under real load whenever it's actually run, without ever
risking contamination of the capacity-testing numbers `run-all-stages.sh`
produces. **Not yet done:** these scripts have been written and syntax-
checked but not yet executed against a live staged run — the recommended
first use is mid-hold-window on the `reference-5000` stage (id 4), per the
same reasoning `LOAD_TEST_PLAN.md` already uses that stage as the reference
point for other cross-checks.
