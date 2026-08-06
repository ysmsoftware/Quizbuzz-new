# Contest Detail Tabs — Audit Fixes: Implementation Guide

**Audience:** the engineer/agent implementing these fixes
**Scope:** `/org/contests/[id]` detail page tabs + org-level analytics removal
**Prerequisite reading:** `docs/CONTEST-LIFECYCLE-FIXES-AND-SPEC.md`

---

## 0. Read this section before writing any code

This codebase has already produced several bugs of the form *"the UI reports success but
nothing happened."* Two fixes in the previous round **introduced new bugs** because a
symbol was assumed to be unused or single-purpose when it wasn't. Do not repeat that.

### 0.1 Mandatory verification protocol

For **every** item below, before changing anything:

1. **Re-verify the finding still exists.** These were observed at a point in time; the
   file may have moved or been fixed. If the symptom is gone, stop and report — do not
   "fix" something that is already correct.
2. **Find every consumer before deleting or changing a signature.** Grep the whole
   `frontend/` tree, not just the file you're in:
   ```bash
   grep -rn "<symbol>" frontend/app frontend/components frontend/lib --include="*.ts" --include="*.tsx"
   ```
   Check `layout.tsx` files specifically — App Router layouts import modules that are
   easy to miss (`app/org/contests/[id]/index.tsx` is imported by its sibling
   `layout.tsx`, not by any page).
3. **Typecheck after each item, not at the end:**
   ```bash
   cd frontend && npx tsc --noEmit -p tsconfig.json
   cd backend  && npx tsc --noEmit -p tsconfig.json
   ```
4. **Never replace a handler with a no-op** to "simplify" it. If a prop looks redundant,
   prove it by finding the component that already performs the action.

### 0.2 The specific trap that already bit us

`ContestActionBar` and `DangerZoneCard` **both** expose an `onCancel(reason)` prop, and
they are rendered in **different files**:

| Component | Rendered in | Who performs the cancel |
| --- | --- | --- |
| `ContestActionBar` | `app/org/contests/[id]/index.tsx` | The component itself (`POST /:id/cancel`) — parent's `onCancel` is only a refresh hook |
| `DangerZoneCard` | `app/org/contests/[id]/overview/page.tsx` | The **parent** — `onCancel` must do the real work |

A change made for one was applied to the other, silently turning a working cancel into a
no-op. **Same prop name ≠ same contract.** Always confirm which component owns the
side-effect.

### 0.3 Two facts about this codebase you must know

- **`UpdateContestSchema` is `.strict()`.** Unknown keys now return `400` instead of
  being silently stripped. If you add a field to any PATCH payload, it must exist in
  `CreateContestBase` or be an explicitly allowed alias.
- **The client `Contest` type is a fabricated superset of the DB model.**
  `adaptServerContest` (`lib/utils/contest.ts`) synthesises fields that have no column
  on `Contest`: `totalMarks` (literally `questions × 2`), `passingMarks`,
  `negativeMarking`, `negativeMarkValue`, `tabSwitchLimit`, `allowBackNavigation`,
  `category`, `difficulty`, `topic`, `fee`, `shortDescription`, `timezone`,
  `webcamRequired`, `fullscreenRequired`. Use `splitPersistableContestFields()` from
  the same module before sending any contest edit payload.

---

## 1. Results tab unreachable during EVALUATION

**Severity:** High — blocks a real admin workflow.
**File:** `frontend/app/org/contests/[id]/index.tsx` (~line 95)

### Problem

```ts
const status = contest?.serverStatus || 'DRAFT';   // BACKEND status
...
{ id: 'results', label: 'Results', icon: CheckCircle2,
  show: ['ENDED', 'RESULTS_OUT', 'COMPLETED'].includes(status) },
```

`status` is the **backend** status. `'ENDED'` is a **frontend `ContestPhase`**, never a
backend value — the backend enum is `DRAFT | PUBLISHED | REGISTRATION_CLOSED | LIVE |
EVALUATION | RESULTS_OUT | COMPLETED | CANCELLED`. So the `'ENDED'` entry never matches
and the Results tab is hidden for the whole evaluation window.

The confusion is understandable: `lib/serverContestStatus.ts` maps
`EVALUATION → 'ENDED'`, so the two names refer to the same moment in different
vocabularies.

### Fix

Replace `'ENDED'` with `'EVALUATION'` in that array. Every other tab in the list already
uses backend statuses correctly — **change only this one**.

### Verify

- Confirm `status` is still sourced from `contest?.serverStatus` (not `contestPhase`).
- Grep the file for any other frontend-phase literals leaking into these `show:` arrays:
  ```bash
  grep -n "'ENDED'\|'RESULTS_PUBLISHED'" "frontend/app/org/contests/[id]/index.tsx"
  ```
  Expect zero matches afterwards.
- Manually: a contest in `EVALUATION` should show the Results tab.

---

## 2. Remove org-level analytics entirely

**Severity:** High — the page displays permanently fabricated zeros.
**Decision (confirmed by product):** there is **no** org-level analytics in the backend
and none is planned. Analytics is **per-contest only**. Remove the org-level surface
rather than leaving a page that renders zeros.

### Evidence

- `lib/services/analytics-service.ts` → `getOrgAnalytics()` returns a hardcoded
  zero-filled object. **No HTTP call.**
- Backend has only per-contest routes: `GET /analytics/:id`, `/:id/live`,
  `/:id/score-distribution`, `POST /:id/refresh`. There is no org aggregate endpoint.

### What to remove

| File | Action |
| --- | --- |
| `frontend/app/org/analytics/page.tsx` | Delete the route |
| `frontend/lib/hooks/useOrgAnalytics.ts` | Delete |
| `lib/services/analytics-service.ts` → `getOrgAnalytics`, `OrgAnalytics`, `TopContestRow` | Remove **only** the org-level members |
| `frontend/app/org/page.tsx` (~lines 24, 54) | Remove the `analyticsService.getOrgAnalytics(...)` usage from the org dashboard home |

### Critical constraints — read before deleting

1. **Do NOT delete `lib/services/analytics-service.ts` wholesale.** Check whether it
   still exports anything used (e.g. `getContestAnalytics`). Delete only the org-level
   members; keep the file if anything else survives.
2. **Do NOT delete `frontend/lib/utils/csv.ts`.** It was extracted recently and is used
   by `app/org/contests/[id]/results/page.tsx` for its CSV export. `useOrgAnalytics`
   also imports it, but that is not the only consumer.
3. **`app/org/page.tsx` is the org dashboard home, not the analytics page.** It must
   keep working after the org-analytics call is removed. Decide with the product owner
   whether the widgets it fed should be removed or repointed at real per-contest data —
   do not leave them rendering zeros, which is the exact defect being fixed.
4. **Remove any navigation entry pointing at `/org/analytics`**, or the sidebar will
   link to a 404:
   ```bash
   grep -rn "org/analytics" frontend/app frontend/components --include="*.tsx"
   ```

### Verify

- `grep -rn "getOrgAnalytics\|useOrgAnalytics\|OrgAnalytics" frontend/` returns nothing.
- `grep -rn "org/analytics" frontend/` returns nothing.
- Frontend typechecks.
- The per-contest Analytics tab (`app/org/contests/[id]/analytics/page.tsx`) is
  **untouched and still working** — it calls real endpoints and is the correct surface.

---

## 3. Certificate view link passes an id where a slug is expected

**Severity:** Medium — verify before fixing; may or may not break at runtime.
**File:** `frontend/app/org/contests/[id]/certificates/page.tsx` (~line 411)

### Problem

```tsx
onClick={() => record.certificate?.id && window.open(`/quiz/${contestId}/certificate/${record.certificate.id}`)}
```

Route is `app/quiz/[slug]/certificate/[id]/page.tsx`. A contest **id** is being placed in
the **slug** position.

### Verify first — this determines whether there's a bug at all

Open `app/quiz/[slug]/certificate/[id]/page.tsx` and check whether it reads the `slug`
param. A grep for `params`/`slug` in that file returned nothing, which suggests it may
only use `[id]` and tolerate any slug value.

- **If `slug` is unused:** the link works by accident. Still fix it for correctness, but
  it is low priority and must not be presented as a user-facing bug fix.
- **If `slug` is used** (for fetching, breadcrumbs, or validation): this is a real broken
  link. Pass `contest.slug` instead of `contestId`. Confirm the contest object on that
  page actually carries `slug` — `adaptServerContest` maps it, but check the specific
  query used by the certificates tab.

### Verify

Issue a certificate on a test contest, click through, and confirm the certificate page
renders rather than erroring or showing a not-found state.

---

## 4. Messages tab exists but is not in the navigation

**Severity:** Medium — a complete, working feature is unreachable.
**Files:** `frontend/app/org/contests/[id]/index.tsx` (tab config),
`frontend/app/org/contests/[id]/messages/page.tsx`

### Problem

`messages/page.tsx` is 385 lines, fully wired to `crmApi.getContestMessages` and
`crmApi.retryMessage`, and renders sent history with retry. It has **no entry** in the
`allTabs` array, so it is reachable only by typing the URL.

Meanwhile `ContestActionBar` has a "Send Message" button opening `SendMessageModal` —
so sending works, but the history view is orphaned.

### Fix

Add a tab entry. Suggested placement after `registrations`:

```ts
{ id: 'messages', label: 'Messages', icon: MessageSquare,
  show: status !== 'DRAFT' && status !== 'CANCELLED' },
```

### Decide before implementing

- **Visibility rule:** messaging targets registrants, so `DRAFT` (no registrants) should
  be excluded. Confirm the intended rule with the product owner rather than copying
  `registrations`' rule blindly.
- **Icon:** check what's already imported in `index.tsx` before adding a new import.

### Verify

- Tab appears for a `PUBLISHED` contest and routes to the existing page.
- The page loads sent history (it already works — you are only exposing it).
- Confirm the scheduled-messaging UI stays removed: `ScheduleToggle.tsx` is intentionally
  an empty module and the "coming soon" card was deleted. **Do not reintroduce them.**

---

## 4b. Participant `/dashboard` section — remove (product decision made)

**Severity:** High — a real, linked, unauthenticated section serving fabricated data.
**Decision (confirmed by product):** there will be **no contact-scoped participant login**
in the current implementation. Participants do not have accounts. Contact profile viewing
and editing happens from the **admin Contacts tab**, which is already fully built.
Therefore `/dashboard` is removed, not integrated.

### 4b.1 Why — the schema settles this

Verified in `backend/prisma/schema.prisma`:

- **`Contact`** = the person, deduplicated per org via `@@unique([organizationId, email])`
  and `@@unique([organizationId, phone])`. Holds durable identity (`email`, `phone`,
  `firstName`, `lastName`, `college`, `department`, `city`, `state`).
- **`Participant`** = one person's involvement in one contest. Has its own ULID `id` and
  a unique `registrationRef`, plus contest-scoped state (`status`, `joinedAt`,
  `checkedInAt`). Constrained by `@@unique([contactId, contestId])` — one registration
  per contact per contest.
- Relationship: **`Contact` 1 ─ N `Participant` N ─ 1 `Contest`.**
- Everything per-contest hangs off `Participant`: `payment`, `submission`, `leaderboard`,
  `certificate`, `sessions[]`, `proctoring[]`, `messages[]`, `proctoringScores[]`.

A participant dashboard ("my contests / my certificates / my results") is inherently a
**Contact-level** view. But authentication is a **per-contest participant session token**
issued during the quiz join flow — it identifies one `Participant`, never the underlying
`Contact`. There is no contact-scoped session, and none is planned. So the dashboard has
no correct identity to run on.

`avatarUrl` exists **only on the `Admin` model**. Notification-preference columns exist
**nowhere**. Neither could be stored even if endpoints were written.

### 4b.2 What already works — the correct surface

The admin Contacts area is complete and is where contact profile view/edit belongs:

| Backend route | Purpose | Frontend |
| --- | --- | --- |
| `GET /contacts` | list | `app/org/contacts/page.tsx` |
| `GET /contacts/:id` | profile detail | `app/org/contacts/[id]/page.tsx` |
| `PATCH /contacts/:id` | **edit profile** | `useContact().updateContact` → `crmApi.updateContact` |
| `DELETE /contacts/:id` | soft delete | same page |
| `GET /contacts/:id/contests` | contests participated | `crmApi.getContactHistory` |
| `GET /contacts/:id/messages` | message history | `crmApi.getContactMessages` |
| `GET /contacts/:id/certificates` | certificates | `crmApi.getContactCertificates` |

All admin-scoped (`authenticatedOrgMiddleware`), all wired on the frontend. **Do not
modify this area** — it is the reference implementation, and it already delivers exactly
what the `/dashboard` profile page was pretending to do.

### 4b.3 What to remove

| Path | Note |
| --- | --- |
| `frontend/app/dashboard/profile/page.tsx` | forms that save nothing |
| `frontend/app/dashboard/certificates/page.tsx` | hardcoded id |
| `frontend/app/dashboard/contests/page.tsx` | hardcoded id |
| `frontend/app/dashboard/results/page.tsx` | hardcoded id |
| `frontend/app/dashboard/settings/page.tsx` | verify contents first |
| `frontend/app/dashboard/page.tsx` | section root |
| `frontend/lib/hooks/useParticipantProfile.ts` | only consumer is the profile page |
| `frontend/lib/services/participant-service.ts` | pure stub — see §5, **do not delete before §5 verification** |

**All four data pages share `const PARTICIPANT_ID = 'QZCP12345ABC'`** — a hardcoded
fake id, identical for every user. There is **no `app/dashboard/layout.tsx`**, so the
section has no auth guard at all.

### 4b.4 Inbound links that MUST be repointed first

`/dashboard` is **linked and reachable** — removing the pages without fixing these
produces 404s on real user paths:

```bash
grep -rn "'/dashboard'\|\"/dashboard\"\|href=\"/dashboard" frontend/app frontend/components --include="*.tsx"
```

Known callers at audit time:

| File | Context | Action |
| --- | --- | --- |
| `app/quiz/registration-success/RegistrationSuccessClient.tsx:68` | post-registration redirect | **Highest priority** — repoint to the contest page (`/[slug]`) or the contests list |
| `components/common/MobileBottomNav.tsx` | whole participant nav (`isParticipantRoute` keys off `/dashboard`) | Remove the participant nav, or repoint entries |
| `app/error.tsx`, `app/offline.tsx`, `app/not-found.tsx` | "go home" fallbacks | Repoint to `/contests` or `/` |
| `app/[slug]/page.tsx:664` | CTA button | Repoint |

### 4b.5 Verify

- `grep -rn "PARTICIPANT_ID\|QZCP12345ABC" frontend/` returns nothing.
- `grep -rn "/dashboard" frontend/app frontend/components` returns nothing.
- Register for a contest end-to-end and confirm the success screen lands somewhere real.
- Admin Contacts tab still lists, opens, edits and shows contest history — regression
  check, since it is the surface `/dashboard` is being removed in favour of.

### 4b.6 If removal is rejected

The only defensible alternative is read-only, and it still requires new work: a
participant-authenticated `GET /me` resolving `Participant → Contact`, with the edit
forms, notification toggles and avatar upload deleted outright. Do **not** keep
notification preferences in any form — the messaging pipeline sends to every registrant
regardless, so a stored preference would be silently ignored. That is the same
"reports success, does nothing" defect this whole effort exists to remove.

---

## 5. Dead service files — VERIFY EXHAUSTIVELY BEFORE DELETING

**Severity:** Low (cleanup). **Risk of doing it carelessly: high.**

### Candidates — status updated after deeper verification

> **An earlier draft of this guide listed both files as "no importers." That was wrong
> for one of them.** The original grep covered only `app/org` and `components` and
> missed `lib/hooks`. This is the second time a "clearly unused" conclusion failed on
> re-checking. Treat the verification block below as mandatory, not advisory.

#### `frontend/lib/services/proctoring.service.ts` — VERIFIED ORPHANED ✅

Exports `startProctoring()` and `enterFullscreen()` — an older, simpler implementation of
tab-switch / fullscreen / window-blur detection. Verified to have **zero importers** by
path, by exported symbol name, via the services barrel, and via dynamic-import search.
`lib/services/index.ts` re-exports only `contestService` and `registrationService`.

It is superseded by the live proctoring stack, which is fully wired on both sides:

- **Detection:** `components/features/proctoring/ProctoringManager.tsx` — fullscreen exit,
  visibility/tab switch, window blur, copy/cut/paste, context menu, keydown blocking,
  plus `lib/proctoring/useFaceDetection`.
- **State:** `lib/stores/proctoring-store`.
- **WebSocket:** `socket.emit('quiz:v1:violation', …)`, emitted both directly from
  `ProctoringManager` and via `useQuizSocket.sendProctoringEvent` (which normalises type
  and severity). Backend handler exists — `quiz.gateway.ts:50` registers
  `socket.on("quiz:v1:violation")` → `handleViolation`, replying with
  `quiz:v1:violation_update`.
- **REST evidence capture:** `POST /quiz-proctoring/presigned-url` → direct storage
  upload → `POST /quiz-proctoring/confirm`. All three exist server-side and are the only
  participant-authenticated routes in the backend.

Still re-run the verification block below before removing, but this one is expected to
come back clean.

#### `frontend/lib/services/participant-service.ts` — **NOT DEAD. DO NOT DELETE IN ISOLATION** ❌

It **is** imported: `lib/hooks/useParticipantProfile.ts` → consumed by
`app/dashboard/profile/page.tsx`.

It is a pure stub — `getProfile` returns hardcoded `fullName: 'Participant'` /
`email: 'participant@example.com'`, and `updateProfile`,
`updateNotificationPreferences` and `uploadAvatar` all return `success: true` without
persisting anything. So it is a **live stub powering a user-facing page**, not dead code.

Deleting it standalone breaks the build. It is removed as part of **§4b** (dashboard
removal), together with its hook and consuming page — not as a cleanup item here.

### Required verification before deleting either file

Run **all** of these and confirm every one is empty:

```bash
# 1. Direct imports by path (both with and without extension, both quote styles)
grep -rn "participant-service\|proctoring\.service" frontend/ --include="*.ts" --include="*.tsx" | grep -v node_modules

# 2. Exported symbol names — find them first, then grep each one
grep -n "^export" frontend/lib/services/participant-service.ts
grep -n "^export" frontend/lib/services/proctoring.service.ts
#    then for each exported symbol:
grep -rn "<symbolName>" frontend/ --include="*.ts" --include="*.tsx" | grep -v node_modules

# 3. Barrel re-exports — lib/services/index.ts may re-export them
cat frontend/lib/services/index.ts

# 4. Dynamic imports and string references
grep -rn "import(" frontend/lib frontend/app frontend/components | grep -i "particip\|proctor"

# 5. Whole-word check for the service instance names
grep -rn "participantService\|proctoringService" frontend/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

**Step 3 matters most.** If `lib/services/index.ts` re-exports them, something may import
from the barrel rather than the file, and the path grep will miss it.

### If anything imports them

Do **not** delete. Report what imports them and stop — an importer means either the file
is live, or the importer itself is dead code, and that is a separate decision.

### If genuinely unused

Prefer emptying the module with an explanatory comment over deleting, matching the
approach used for `ScheduleToggle.tsx`, so any stale import fails loudly at build time:

```ts
/**
 * REMOVED — never integrated. Returned hardcoded data with no HTTP calls.
 * <what to do instead / which real API supersedes it>
 */
export {};
```

Then typecheck. If nothing breaks, the file may be deleted in a follow-up commit.

---

## 6. Not audited — flag, do not guess

The following were **not** verified field-by-field and should not be assumed correct:

- `app/org/contests/[id]/questions/page.tsx` (1,548 lines)
- `app/org/contests/[id]/registrations/page.tsx` (1,119 lines)
- `app/org/contests/[id]/submissions/page.tsx` (909 lines)
- `app/org/contests/[id]/live/page.tsx` (870 lines)

All four call real APIs and showed **no** stub markers (no toast-only handlers, no
`console.log` stubs, no TODO/mock comments). What was *not* checked is whether the
fields they render actually exist in the backend response — the same class of problem as
the fabricated fields in `adaptServerContest` (§0.3).

If you audit these, the method is: for each adapter/mapper feeding the page, compare
every field against the corresponding Prisma model in `backend/prisma/schema.prisma` and
the actual `select`/`include` in the repository method. Report hardcoded constants and
derived-but-presented-as-real values. **Do not fix by inventing backend columns.**

---

## 7. Suggested order

1. **§1 Results tab** — one word, unblocks a real workflow, zero risk.
2. **§4 Messages tab nav** — exposes a finished feature, low risk.
3. **§3 Certificate link** — verify first; may be a non-issue.
4. **§4b `/dashboard` removal** — highest user-facing impact (fabricated data shown to
   real participants, no auth guard). Repoint inbound links **before** deleting pages.
   Absorbs `participant-service.ts` and `useParticipantProfile.ts`.
5. **§2 Org analytics removal** — largest blast radius; needs the `app/org/page.tsx`
   decision made before starting.
6. **§5 `proctoring.service.ts`** — last, and only after the verification block passes
   cleanly. (`participant-service.ts` is handled in §4b, not here.)

---

## 8. Definition of done

- [ ] Each item independently verified as still-present before being changed
- [ ] `cd frontend && npx tsc --noEmit` passes
- [ ] `cd backend && npx tsc --noEmit` passes
- [ ] No new toast-only / `console.log`-only handlers introduced
- [ ] No handler replaced by a no-op without proving another component owns the action
- [ ] `grep -rn "getOrgAnalytics\|org/analytics" frontend/` returns nothing
- [ ] `grep -rn "PARTICIPANT_ID\|QZCP12345ABC\|/dashboard" frontend/app frontend/components` returns nothing
- [ ] Post-registration redirect lands on a real page (register end-to-end to confirm)
- [ ] Per-contest Analytics tab still functional (regression check — it is the surface
      org-level analytics is being removed *in favour of*)
- [ ] Admin Contacts tab still lists / opens / edits / shows contest history (regression
      check — it is the surface `/dashboard` is being removed *in favour of*)
- [ ] Anything that could not be verified is reported as unverified rather than assumed
