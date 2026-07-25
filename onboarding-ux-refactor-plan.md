# Onboarding UX Refactor — Design & Implementation Plan

Status: **PLAN ONLY — no code changed.** Read against the real codebase
(`frontend/app/org/onboarding/page.tsx`, `frontend/app/org/layout.tsx`,
`backend/src/modules/onboarding/*`, `backend/src/modules/organization/*`,
`backend/prisma/schema.prisma`, `frontend/app/org/settings/page.tsx`).

Decisions locked in with Austin before writing this plan:
1. Onboarding renders as a **true modal/dialog overlay** on top of the dashboard (blurred backdrop, same URL, sidebar/header not clickable while open).
2. **Plan Selection is removed from the wizard entirely** and becomes a separate post-onboarding upsell prompt.
3. Contact step **prefills name + email only** from the signup admin record; phone stays blank (signup has no phone field — out of scope for this pass).

---

## 0. Confirmed root causes (from reading the code)

| Symptom you reported | Root cause found in code |
|---|---|
| Navbar/sidebar visible during onboarding, user can navigate away | `app/org/onboarding/page.tsx` is a route **nested inside** `app/org/layout.tsx`. Next.js renders `OrgLayout`'s sidebar + header around *any* page under `/org/*`, including `/org/onboarding`. The wizard's own `min-h-screen` styling only fills the `<main>` content pane, not the whole viewport. |
| "Logo/website aren't saved" | They **are** saved (`onboarding.repository.ts → saveIdentityStep` writes `Organization.logoUrl/website`). They're just never rendered anywhere except the Settings → General logo preview. Effectively unused, so removing them from onboarding is safe — nothing else in the app reads them. |
| Steps feel duplicated / oddly asked | Confirmed: Settings → "Profile Details" tab already re-implements Use Case, Contact & Locale, GST, and Billing as properly laid-out Cards, via a **separate** organization endpoint (`organization.api.ts → updateOrgProfile`), independent of the onboarding module. The wizard and Settings write to the *same* `OrganizationProfile` row through two different code paths. This is real duplication, not just a visual issue. |
| Signup already asks name/email | Confirmed: `RegisterAdminSchema` = `email, password, firstName, lastName` only. **No phone field exists on `Admin` at all.** Org name is auto-set to `"{firstName}'s Organization"` in `admin-auth.service.ts`. |
| Plan cards "stacked" | `PlanSelectionStep` renders `plans.map()` inside a `space-y-4` div — a vertical list, not a grid. Currently moot since `STATIC_PLANS` only has one "Free" entry, but the component was never built to handle more than one plan side-by-side. |
| Country/State/City are free-text | `ContactLocaleStepSchema` — `country/state/city` are plain `z.string().optional()`. No dropdown, no canonical list, matches your ask to not hardcode one. |

---

## 1. Shell architecture — modal overlay instead of a nested route

**Current:** `/org/onboarding` is a page inside `OrgLayout` → sidebar/header render around it.

**Target:** Onboarding becomes a **client-side modal** rendered by `OrgLayout` itself (not a separate route), gated by the same `onboardingQuery` that already lives in `OrgLayout`. The `/org/onboarding` route is deleted; there is no separate URL to bounce to or fall out of sync with.

### 1.1 Where it lives
- New component: `frontend/components/features/organization/OnboardingModal.tsx` (or under a new `onboarding/` feature folder — matches your existing `components/features/<domain>/` convention).
- Rendered from `OrgLayout` (`app/org/layout.tsx`), as a sibling to `{children}`, e.g. inside the existing `<div className="flex h-screen ...">` root, using the existing `Dialog`/overlay primitives already in `components/ui/dialog.tsx` — **no new modal library needed**, you already have Radix Dialog installed (`@radix-ui/react-dialog` via `dialog.tsx`).
- `OrgLayout` keeps its current onboarding-status query (`useOnboardingStatus`), but instead of `router.push('/org/onboarding')`, it sets a boolean (`isOnboardingModalOpen`) or simply renders the modal conditionally when `!completed && role === 'OWNER'`.

### 1.2 Blocking behaviour
- Dialog uses a non-dismissible backdrop while onboarding is incomplete: no `Escape` key close, no click-outside close, no visible close (X) button — mirrors "no sidebar clicks possible."
- Sidebar/header remain **mounted but inert**: apply `pointer-events-none` + `aria-hidden` (or Radix's built-in focus-trap via `Dialog` handles this automatically — clicking outside the dialog content won't reach the sidebar because Radix traps focus and the overlay itself intercepts pointer events). No manual `pointer-events-none` hack should even be needed if we use Radix `Dialog` correctly with `modal={true}` (the default).
- Background dashboard is visually blurred (`backdrop-blur` on the overlay layer) so the user still perceives "there's a dashboard" without being able to touch it — matches your "overlay between the main application" description.
- "Skip setup for now" remains available as a text link inside the dialog (unchanged behavior — calls `completeOnboarding` and closes the modal).

### 1.3 Files touched
| File | Change |
|---|---|
| `frontend/app/org/onboarding/page.tsx` | **Deleted.** Its step-form logic moves into the new modal component. |
| `frontend/app/org/layout.tsx` | Remove the `router.push('/org/onboarding')` redirect effect; render `<OnboardingModal open={...} />` instead. Sidebar/header markup unchanged otherwise. |
| `frontend/components/features/organization/OnboardingModal.tsx` | **New.** Houses the stepper, using `Dialog`/`DialogContent` from `components/ui/dialog.tsx` as the shell. |
| `frontend/lib/hooks/useOnboarding.ts` | Unchanged — hooks are shell-agnostic, already used by both layout and (previously) the page. |

### 1.4 Why this is safe
- No backend change needed for this part — `GET /onboarding/status`, `PATCH /onboarding/step/:step`, `POST /onboarding/complete` stay exactly as they are; only the frontend shell changes.
- No URL contract is broken since `/org/onboarding` was never linked to from anywhere else in the app (verified — not present in `navItems`, not deep-linked from emails).

---

## 2. Step content — re-scoped and re-ordered

Wizard shrinks from **5 steps** to **3 steps** (Plan Selection removed per your decision; Identity simplified).

### Step 1 — "Organization Name" (replaces "Your Organization" / Identity)
- **Remove:** Logo URL, Website (unused elsewhere, already redundant with Settings → General where they *are* rendered with a live preview).
- **Add:** A single editable **Organization Name** field, pre-filled with the value already set at signup (`"{firstName}'s Organization"`). This directly answers your ask: *"they can rename that build... prefilled with already collected data."*
- Backend: `onboarding.validator.ts → IdentityStepSchema` changes from `{ logoUrl?, website? }` to `{ name: z.string().min(2).max(150) }`. `onboarding.repository.ts → saveIdentityStep` writes `Organization.name` instead of `logoUrl/website`.
- Note: `organization.service.ts` already has a `generateUniqueSlug` — renaming the org here does **not** change the slug (slug stays fixed post-creation, matching the existing Settings page behavior where slug is read-only). Confirm this is desired (I'm assuming yes, since Settings already treats slug as immutable).

### Step 2 — "About your Organization" (Use Case, unchanged fields, better layout)
- Same fields as today (`primaryUseCase`, `useCaseOther`, `sizeBucket`, `expectedContestsPerMonth`, `expectedParticipants`), same `ChipSelect` component (it already works well — keep it).
- Visual-only fix: wrap in the same Card/section pattern already used in Settings → Profile Details (`Card` + `CardHeader` + `CardDescription`), instead of the current bare `space-y-6` block, so it doesn't look "stacked and not laid out." No functional/schema change.

### Step 3 — "Contact & Region" (trimmed)
- **Keep:** Contact Name, Contact Email, Contact Phone, Country, State, City, Timezone.
- **Prefill:** Contact Name / Contact Email default to the logged-in admin's `firstName + lastName` / `email` (read from `useAuth()`), editable. Phone stays blank (per your decision — no phone captured at signup).
- **Remove from this step, entirely:** GST Number, Billing Address, Preferred Currency. These already exist as a dedicated "Billing Details" card in Settings → Profile Details — no need to ask twice, and it satisfies your "keep it in a separate section" request since that section already exists.
- **Country/State/City become searchable dropdowns** instead of free-text (see §3 below), chained Country → State → City.
- **Attribution fields** (`heardAboutSource`, `marketingOptIn`) merge into this same step rather than being their own step — reduces step count further and keeps the wizard to 3 short screens. (If you'd rather keep Attribution as its own 4th step for clarity, that's a one-line change to the step list — flag if you want that instead of merged.)

### Backend schema changes required
- `onboarding.validator.ts`:
  - `IdentityStepSchema` → `{ name: string }` (was `logoUrl/website`).
  - `ContactLocaleStepSchema` → drop `gstNumber`, `billingAddress`, `preferredCurrency` (still settable via the existing Settings/organization-profile endpoint, untouched).
  - `AttributionStepSchema` fields merge into whichever step they land in (no schema shape change needed, just which HTTP call carries them — could even keep `ATTRIBUTION` as its own `PATCH` call fired from the same screen, simplest option, no validator change at all).
- `onboarding.service.ts` — remove `PLAN_SELECTION` from `STEP_ORDER`, delete plan-selection branch in `saveStep`, delete `getPlans()` / `createHandoffToken()` **from the onboarding module** (see §4 — this logic moves, not deleted outright).
- `onboarding.repository.ts` — `saveIdentityStep` writes `name` instead of `logoUrl/website`.
- `backend/prisma/schema.prisma` — **no migration needed.** `OrganizationProfile` already has all the fields we're keeping; we're only changing which step writes which subset, not the schema.

---

## 3. Country / State / City — dropdown, no hardcoding

### Recommendation: `country-state-city` (npm)
- Bundled JSON data (countries → states → cities), **no API key, no network calls**, actively maintained, fully typed for TypeScript.
- Deliberately **not** recommending `react-country-state-city` or similar pre-styled libraries — they ship their own CSS and pre-built `<select>`/dropdown UI that would fight your existing design-token system (`--primary`, `--accent`, shadcn styling) and your `frontend-design` conventions. Better to use the data-only package and build the dropdown from primitives you already have.
- You already have `cmdk` (`components/ui/command.tsx`) and `@radix-ui/react-popover` installed — that's exactly the combo needed for a searchable combobox. No new UI dependency, only the one data package.

### New shared component
- `frontend/components/shared/Combobox.tsx` (or `LocationCombobox.tsx`) — generic searchable single-select built on `Command` + `Popover`, styled to match `ChipSelect`'s existing look/spacing so the wizard stays visually consistent.
- Used three times in the Contact step: Country → (filters) → State → (filters) → City. Selecting a new Country clears State/City; selecting a new State clears City — standard cascading-select behavior.

### Data storage — no schema change
- Keep `country`, `state`, `city` as plain `String?` columns exactly as they are today. The dropdown only changes *how the value is chosen* on the frontend (from the library's canonical name list) — it still submits a plain string to the same validator/schema, so **zero backend risk**. This avoids introducing ISO country/state codes into the DB, which would be a bigger, unnecessary migration for what's currently a display/reporting field, not a field anything else joins against.

---

## 4. Plan Selection — moved out of the wizard

Per your decision, this becomes a **separate, later prompt** rather than wizard step 4/5.

### New flow
1. Onboarding modal completes (all 3 steps saved + `POST /onboarding/complete`) → modal closes → user lands on `/org` dashboard as normal.
2. A **second, dismissible** modal/toast — "Upgrade your workspace" — can be shown immediately after, or on a later trigger (e.g. next login, or when a paid-only action is attempted). Given only one Free plan exists right now, my suggestion: **build the component now, but gate its trigger behind a config flag / feature check that's off until there's an actual second paid plan to show** — otherwise you're prompting an upgrade to a screen with nothing to upgrade to.
3. When it does trigger, it reuses `getOnboardingPlans()` / `createBillingHandoff()` — logic already exists and works; it just moves call-sites.

### Backend
- Keep `GET /onboarding/plans` and `POST /onboarding/handoff` **as-is** — they're generically useful, not onboarding-wizard-specific. Optionally relocate them under a more accurate route namespace later (e.g. `/billing/plans`, `/billing/handoff`) since they no longer belong to the onboarding step flow — this is a naming cleanup, not urgent, flag if you want it done now vs. later.
- `PlanSelectionStep` component moves from the wizard file into its own `frontend/components/features/organization/UpgradePromptModal.tsx`, and gets the **grid layout fix** while it's there: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4` instead of `space-y-4`, so it's future-proof for when a second/third plan is added — instead of the current vertical stack that only "works" by accident because there's just one plan today.

---

## 5. Step-by-step file change summary

### Frontend
| File | Action |
|---|---|
| `app/org/onboarding/page.tsx` | Delete |
| `app/org/layout.tsx` | Remove route-redirect effect; mount `<OnboardingModal>` |
| `components/features/organization/OnboardingModal.tsx` | New — 3-step wizard in a `Dialog` |
| `components/features/organization/UpgradePromptModal.tsx` | New — moved-out plan selection, grid layout |
| `components/shared/Combobox.tsx` | New — generic searchable combobox (Command + Popover) |
| `lib/constants/` | Remove nothing; `org-profile-options.ts` stays as-is |
| `lib/hooks/useOnboarding.ts` | Minor: drop plan-related hooks or keep them but repoint to wherever `UpgradePromptModal` lives |
| `package.json` | Add `country-state-city` |

### Backend
| File | Action |
|---|---|
| `onboarding.validator.ts` | `IdentityStepSchema` → `{ name }`; `ContactLocaleStepSchema` drops gst/billing/currency; remove `PlanSelectionStepSchema` from step-driven flow |
| `onboarding.service.ts` | Remove `PLAN_SELECTION` from `STEP_ORDER`; simplify `saveStep`; keep `getPlans`/`createHandoffToken` methods (still used, just called from a different frontend surface) |
| `onboarding.repository.ts` | `saveIdentityStep` writes `name`, not `logoUrl/website` |
| `onboarding.types.ts` | Update `IdentityStepInput`, trim `ContactLocaleStepInput` |
| `backend/prisma/schema.prisma` | **No changes** |

---

## 6. Open items / things to confirm before implementation

1. **Attribution fields placement** — merged into Contact step (as written above) or kept as its own short step? Either is a small change; just pick one so the step count is locked before building.
2. **Org rename on Step 1 — does it affect the slug?** Current assumption: no, slug stays fixed (matches Settings page behavior). Confirm.
3. **Upgrade prompt trigger timing** — show immediately after onboarding closes, or defer until a real second plan exists? Affects whether `UpgradePromptModal` ships wired-up now or built-but-dormant.
4. **Route cleanup** — any existing links/emails pointing at `/org/onboarding` that need a redirect stub left behind for old bookmarks? (I didn't find any in the codebase, but worth a final grep before deleting the route.)

Once these are confirmed, this plan translates directly into a small, additive PR: one deleted route, two new modal components, one new shared combobox, a handful of trimmed Zod schemas — no destructive schema migration required anywhere.
