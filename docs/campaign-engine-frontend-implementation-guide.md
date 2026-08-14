# Campaign Engine Decoupling — Frontend Implementation Guide

**Audience: an AI coding agent (Claude Code) building the `Quizbuzz-new/frontend` side of this refactor in its
own session, in parallel with a separate backend session** (`campaign-engine-backend-implementation-guide.md`).
Treat that doc's §3, §4, §6, §7 (the new `LeaderboardScope` shape, the relaxed `AmbassadorGroupType`, the optional
`phaseTemplate`, and the extended campaign-list query params) as the API contract this session builds against. If
the live backend isn't ready yet, build against the shapes documented here and flag any divergence rather than
silently guessing.

**Scope — read this twice before starting.** This pass is the **campaign creation wizard, the post-publish
campaign management dashboard, the campaign list, and campaign templates** — everything under
`app/org/ambassadors/campaigns/*` and `components/features/ambassador/{wizard,dashboard}/*` plus the shared
editors (`LeaderboardPrizesEditor.tsx`, `RepeatingRowTable.tsx`, etc.). It does **not** touch anything under
`app/ambassador/*` (the ambassador's own apply/login/dashboard pages) or `app/org/ambassadors/applications*` (the
applications review queue) — those already work and are explicitly the *next* iteration. If a change here happens
to also improve something on the ambassador-facing side, note it but don't act on it this pass.

**Why this matters, restated in one paragraph:** the wizard, the status-gated management dashboard, and the
multi-select ambassador-type eligibility on a campaign (`ambassadorTypesAllowed`, already working in
`PromotionStep.tsx`) are already built correctly — an ambassador is a generic promoter (student/staff/general),
and a campaign already declares which type(s) it's open to. What's still coupled to one client's pilot brief is
the *leaderboard editor* (a fixed 4-option `DEPARTMENT`/`COLLEGE` toggle list) and the *ambassador-structure group
type picker* (locked to 3 hardcoded options) — both need to become genuinely campaign-defined, driven by whatever
fields the campaign's own selected ambassador types actually collect, not a fixed academic vocabulary.

---

## 1. Design constraints — read before writing any component

**Reuse the existing theme. Do not add a new color palette, do not use blue or purple.** Every color comes from
the CSS variables in `app/globals.css`: `--primary` (teal/cyan), `--accent` (amber/gold), `--secondary`, `--muted`,
`--destructive`, `--success`, `--warning`, `--border`, plus `--chart-1`..`--chart-5` if a leaderboard visualization
ever wants distinct series colors. Always reach for the Tailwind classes mapped to these vars (`bg-primary`,
`text-accent-foreground`, `border-border/50`) — never a raw hex/oklch value. For rank/medal moments (1st/2nd/3rd
on a leaderboard), use `--warning` for gold-ish accents and `--muted`/`--secondary` for silver/bronze, matching
the existing `RANK_COLOR` convention already in `LeaderboardTable.tsx`.

**Reuse shadcn/ui before building anything new.** The full set is already installed in `components/ui/`: `Card`,
`Button`, `Input`, `Select`, `Dialog`, `Sheet`, `Badge`, `Tabs`, `Table`, `Progress`, `Avatar`, `Skeleton`, `Empty`,
`Checkbox`, `DatePicker`, plus the custom `PaginationBar`. This feature already has its own small library of
shared editors in `components/features/ambassador/` — `RepeatingRowTable.tsx`, `MilestoneTiersEditor.tsx`,
`SpeedBonusEditor.tsx`, `LeaderboardPrizesEditor.tsx`, `ShareTemplatesEditor.tsx` — **extend these before writing
new ones.** Every change in this pass should modify an existing shared component to be more generic (accepts a
new column/field type, reads config instead of a hardcoded list) rather than forking a new one-off component next
to it. Only create a genuinely new component when nothing existing covers the need, and when you do, ask: is this
ambassador-specific, or is it a general-purpose UI primitive (e.g. a tag/combobox input)? Ambassador-specific goes
in `components/features/ambassador/`; a true general-purpose primitive with zero ambassador-specific logic is a
candidate for `components/ui/` instead, so other features can reuse it too — check with a quick grep for an
existing equivalent (e.g. a combobox/creatable-select) before assuming one doesn't exist.

**Premium feel = disciplined whitespace, not decoration.** This is an org-admin tool, but it should feel like the
research benchmark (Microsoft/Google/Salesforce ambassador consoles) — calm, confident spacing, not a cramped
form. Concretely: stick to the `space-y-4`/`space-y-6` rhythm already used throughout this feature's `Card`
sections, keep `Card` content at `p-6`/`CardContent`'s default padding rather than tightening it, give wizard step
bodies a readable max width instead of stretching full-bleed on wide desktop screens (check what
`CampaignWizard.tsx` currently does for its content column width and keep new steps consistent with it), and never
stack more than one dense `Table`/`RepeatingRowTable` per screen without breathing room between them
(`Card`-wrapped with its own header, as every existing editor already does). Don't over-correct into minimalism
either — labels, helper text, and section descriptions (already present throughout, e.g.
`AmbassadorStructureStep.tsx`'s subtitle under its `CardTitle`) are part of the premium feel, not clutter; keep
that pattern for every new/changed section.

**Inline, per-field error handling everywhere — this is already the established pattern, keep using it exactly.**
Every step/editor in this feature takes an `errors?: FieldErrorMap` prop (`Record<string, string>`, dot-path keyed
— see `campaign-schema.ts`'s `zodIssuesToErrorMap`) and renders `<p className="text-sm text-destructive">` under
the offending field, with `border-destructive` added to the input/select itself. Every new field this pass
introduces (the leaderboard field-key picker, the group-type combobox, the phase-template editor) follows this
exact pattern — no new error-display convention, no toast-only validation for field-level issues (toasts stay
reserved for save-success/save-failure at the request level, as `LeaderboardsTab.tsx` already does).

**Responsiveness:** org-admin campaign screens (wizard, management dashboard, list) follow the existing
desktop-oriented org-admin convention (see `app/org/contacts` for precedent) — but must not break on a narrower
viewport. Every table gets the existing `overflow-x-auto` wrapper (already used in `CampaignsList.tsx` and
`RepeatingRowTable.tsx`); every multi-column form grid collapses to a single column below `sm:` (see
`TimelineStep.tsx`'s `grid grid-cols-1 sm:grid-cols-2` for the exact pattern to reuse). This pass does not touch
`app/ambassador/*`, so the mobile-first-specifically constraint from the original frontend guide doesn't apply
here — that's for the next iteration.

---

## 2. Fix #1 (frontend side) — remove any hardcoded pilot-template references

Grep the frontend for `quizbuzz-5k-pilot-template` and `COLLEGE_STUDENT` before starting. If the template-picker
UI (wherever "Start from scratch" vs "Use a template" is offered at `campaigns/new`) special-cases that ID string
in any conditional (e.g. disabling delete, showing a "System" badge), remove that conditional — once the backend
change lands (§2 of the backend guide), every template row, including YSM's own seeded copy, is a normal template
and should render identically to any admin-created one. If no such special-casing exists in the frontend today
(the backend's `systemTemplate` object was injected server-side, so this may be a no-op), confirm that and move
on — don't add speculative code for a case that isn't there.

---

## 3. Fix #2 (frontend side) — the leaderboard editor becomes campaign-defined

This is the largest change in this pass. Today, `LeaderboardPrizesEditor.tsx` and `LeaderboardTable.tsx` both
import a fixed `LEADERBOARD_SCOPES` array and a hardcoded `SCOPE_LABEL` map
(`{ DEPARTMENT: 'Department', COLLEGE: 'College', ... }`) from `lib/types/ambassador.ts`. Both need to change from
"toggle one of 4 fixed cards" to "the admin defines their own cuts, grouped by whichever `applicationData` field
key(s) the campaign's own ambassador types actually collect."

### 3.1 `lib/types/ambassador.ts` — type changes

```ts
// Replaces the old string-union LeaderboardScope + LEADERBOARD_SCOPES const array
export type LeaderboardScopeKind = 'INDIVIDUAL_AMBASSADOR' | 'APPLICATION_FIELD_GROUP';

export interface LeaderboardScope {
  kind: LeaderboardScopeKind;
  groupByFieldKeys?: string[];
}

export interface LeaderboardCut {
  scope: LeaderboardScope;
  label: string;
  rankedBy?: 'REGISTRATION_RATE_PERCENT';
  winnerCount?: number;
  ranks: { rank?: number; rankRange?: [number, number]; cashAmount?: number; goodie?: { label: string; cashEquivalent?: number }; label?: string }[];
  consolation?: { label: string; cashAmount: number };
}
```

`LEADERBOARD_SCOPES` (the fixed 4-item render list) is deleted — there's no longer a fixed list to iterate, since
group-based cuts are now admin-defined from the campaign's own field keys.

### 3.2 `campaign-schema.ts` — matches the backend's `leaderboardScopeSchema`

```ts
const leaderboardScopeSchema = z.object({
  kind: z.enum(['INDIVIDUAL_AMBASSADOR', 'APPLICATION_FIELD_GROUP']),
  groupByFieldKeys: z.array(z.string().min(1)).min(1).max(3).optional(),
}).superRefine((data, ctx) => {
  if (data.kind === 'APPLICATION_FIELD_GROUP' && (!data.groupByFieldKeys || data.groupByFieldKeys.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select at least one field to group by.', path: ['groupByFieldKeys'] });
  }
});
```

`leaderboardCutSchema.scope` now references this instead of `z.enum(LEADERBOARD_SCOPES as [string, ...string[]])`.

### 3.3 `LeaderboardPrizesEditor.tsx` — rewrite the scope picker

Replace the fixed `LEADERBOARD_SCOPES.map(...)` render loop with:

- **One always-on card, "Individual Ambassador"** (`{ kind: 'INDIVIDUAL_AMBASSADOR' }`) — same enable/disable
  toggle UX as today, just no longer part of a fixed 4-item list; it's simply always offered first since every
  campaign has individual ambassadors regardless of what other grouping fields exist.
- **An "Add a group leaderboard" button** below it that appends a new cut with `{ kind: 'APPLICATION_FIELD_GROUP',
  groupByFieldKeys: [] }` and an editable `label` (free text, defaulting to something sensible like "New
  Leaderboard" rather than a looked-up scope label — there's no lookup table anymore, the admin names it).
- **Each `APPLICATION_FIELD_GROUP` card gets a field-key picker**: a multi-select (reuse `Checkbox` rows, same
  pattern `PromotionStep.tsx` already uses for `ambassadorTypesAllowed`, capped at the backend's `max(3)`) sourced
  from the **union of `applicationFields` across the campaign's currently-selected `ambassadorTypesAllowed`**
  (fetch via the existing `useAmbassadorTypes(activeOrg.id)` hook already used in `PromotionStep.tsx`, filter to
  the types selected in this draft, flatten their `applicationFields`, de-duplicate by `key`). If zero types are
  selected yet (admin hasn't reached the Promotion step), show an inline empty state: "Select ambassador types in
  the Promotion step first to choose what to group by" — don't silently render an empty picker.
- **Remove-cut action** for any group cut (not the individual one, which stays a toggle like today).

Everything below the scope/label header — the rank-table editing via `RepeatingRowTable`, the consolation-prize
fields — is unchanged; only the scope-selection UI at the top of each card changes.

### 3.4 `LeaderboardTable.tsx` — drop the hardcoded label map

Delete `SCOPE_LABEL`. The table already receives whatever cut it's rendering from the campaign's own config —
render `cut.label` (already admin-authored, already passed through) instead of looking `scope` up in a map. Where
the component currently does `SCOPE_LABEL[scope].toLowerCase()` for the empty-state copy ("Registrations will
populate the {…} leaderboard"), take the cut's `label` as a prop instead of deriving it from `scope`.

### 3.5 Report/detail pages using `LeaderboardTable`

Grep for every call site of `<LeaderboardTable scope={...} .../>` (the campaign report page, the dashboard's
Leaderboards tab) and confirm each one now also passes the cut's `label` — these call sites likely already have
the full `LeaderboardCut` object in scope (from the campaign's `rewardConfig.leaderboardPrizes`), so this should
be a prop-plumbing change, not a new data fetch.

**Verification:** create a draft campaign, select an ambassador type whose `applicationFields` include a
non-academic key (e.g. `team`), add a group leaderboard cut keyed on `team`, save, and confirm the Leaderboards
tab and report page both render using that field — no reference to "College"/"Department" anywhere in the UI for
this campaign.

---

## 4. Fix #3 (frontend side) — group type becomes free text with suggestions

`AmbassadorStructureStep.tsx` (wizard) currently uses `RepeatingRowTable`'s `select` column type with
`options: ['DEPARTMENT', 'COLLEGE', 'CUSTOM']` for `groupType`. Check `StructureTab.tsx` (dashboard) for the same
pattern — it likely reuses the same column definition or a near-identical one; update both together.

### 4.1 `RepeatingRowTable.tsx` — extend the column type generically

Add a new column `type: 'combobox'` alongside the existing `'text' | 'number' | 'select'` — a free-text `Input`
with a small suggestions dropdown (options shown, but not enforced; typing a value not in the list is allowed and
kept as-is). This is a genuinely reusable primitive-level addition to an already-shared component, not a one-off
hack for this one field — check first whether `components/ui/` already has a combobox/creatable-select primitive
to build this on top of (e.g. via `cmdk`/shadcn's `Command` component, common in this ecosystem); if one exists,
compose it here rather than hand-rolling a new dropdown-plus-input from scratch.

```ts
export interface RepeatingRowColumn<T> {
  key: keyof T;
  label: string;
  type: 'text' | 'number' | 'select' | 'combobox';
  options?: string[]; // for 'select': the only allowed values; for 'combobox': suggestions only, free text still accepted
  placeholder?: string;
}
```

### 4.2 `AmbassadorStructureStep.tsx` / `StructureTab.tsx` — use the new column type

```ts
{ key: 'groupType', label: 'Group Type', type: 'combobox', options: ['Department', 'College', 'Team', 'Region', 'Cohort'], placeholder: 'Type or pick a category' },
```

No other change to these two files — `newRow()`'s default (`groupType: 'DEPARTMENT'`) can become
`groupType: 'Department'` or an empty string; either is fine since the backend now accepts any non-empty string up
to 50 characters.

**Verification:** add a structure row with a typed-in `groupType` of "Region" (not one of the suggested options),
save, reload, confirm it persists as typed.

---

## 5. Fix #5 (frontend side) — campaign timeline phases become optionally customizable

`TimelineStep.tsx` currently calls `generateCampaignPhases(start, end)` (no third argument) purely client-side for
a read-only preview — it doesn't even round-trip through the backend today. Per the backend guide's §6, the
backend now accepts an optional `phaseTemplate` on the campaign. Add:

- An "optional" toggle or a small "Customize phases" link/button under the read-only preview (don't put this
  above the fold by default — most campaigns will use the default 6 phases, so keep this an opt-in expansion, not
  a mandatory extra step, consistent with Ambassador Structure already being marked optional in `wizard-types.ts`).
- When expanded, a `RepeatingRowTable`-based editor over `{ key, label, fraction }` rows (reuse the existing
  component again — this is exactly its use case: a small repeating list of structured rows). Validate fractions
  sum to ~1 client-side before allowing save (mirror whatever tolerance the backend's Zod `.refine` uses — check
  the backend guide/PR once implemented rather than guessing a tolerance independently).
- On save, this becomes part of the draft's `phaseTemplate` field, PATCHed the same way every other wizard step
  field is (via `useOrgAmbassadorCampaign`'s `updateCampaign` mutation) — no new save mechanism.
- `generateCampaignPhases` (the frontend copy in `campaign-timeline.ts`, mirroring the backend's pure function for
  the live preview) gains the same optional third parameter (`template?: CampaignPhaseTemplateEntry[]`), defaulting
  to today's hardcoded 6-entry array so campaigns that never customize this see identical behavior to today.

This is the lowest-priority fix in the set — land it last, or defer if the session runs long, since it's additive
and nothing else depends on it.

---

## 6. Campaign list — filtering, sorting, search, and type visibility

`CampaignsList.tsx` today has no filter/search controls at all — just a plain paginated table. Per the backend
guide's §7, `GET /org/ambassadors/campaigns` now accepts `status` (comma-separated multi-value), `ambassadorType`,
and `q` (name substring), plus `sortBy` extended to include `startDate`/`status`.

- **Search input** — a debounced `Input` above the table (reuse whatever debounce pattern an existing org-admin
  list already uses — check `app/org/contacts` first rather than adding a new debounce utility), wired to the `q`
  filter param.
- **Status filter** — multi-select (a small `Select` with checkable items, or a `Popover` + `Checkbox` list —
  match whatever pattern the codebase already uses for multi-value filters elsewhere; `ListApplicationsQuerySchema`
  on the backend already supports this shape for applications, so if the applications queue UI has a multi-status
  filter already built, mirror it exactly here rather than inventing a second pattern).
- **Ambassador-type filter** — single-select `Select` sourced from `useAmbassadorTypes(activeOrg.id)`, wired to
  `ambassadorType`.
- **Sort** — either clickable column headers (Name/Status/Created/Start Date) toggling `sortBy`/`sortOrder`, or a
  small `Select` if that's the existing convention elsewhere in this codebase's org-admin lists — check `app/org/contacts` again and match it exactly rather than choosing independently.
- **Type badges per row** — add a `TableCell` (or fold into the Name cell) rendering one `Badge` per entry in that
  row's `ambassadorTypesAllowed` (now included in `CampaignListItem` per the backend guide's §7), using
  `useAmbassadorTypes` to resolve each key to its display `label` rather than rendering the raw key. This directly
  answers the requirement that a campaign's ambassador-type eligibility ("is this a student campaign, staff
  campaign, or a mix of both") is visibly clear from the list, not something the admin has to open the campaign to
  discover.
- **`CampaignsFilters`** (`lib/api/ambassador-campaign.api.ts`) and `useOrgAmbassadorCampaigns`'s filter param both
  gain `q?: string` and `ambassadorType?: string`, and `status` changes from a single value to
  `string | string[]` (joined with `,` when building the query string, same convention the backend's
  `statusListSchema` expects) — keep the hook's public shape (`{ data, pagination, isLoading, ... }`) unchanged,
  this is purely an additive filter-param change.

Also add the same type-badge treatment to the campaign detail/management dashboard's summary header (wherever
`ReadOnlySummary.tsx`/the campaign detail page currently shows name/status/dates) — an admin looking at one
specific campaign should see "Open to: Student, Staff" (or whichever types) as prominently as they see its status
badge today.

---

## 7. Build order (mirrors the backend guide's §9, land in the same sequence where dependent)

1. Fix #1 check (§2) — quick grep-and-verify, no real work if nothing's found.
2. Fix #2 (§3) — the leaderboard editor rewrite. This is the biggest piece; needs the backend's new
   `LeaderboardScope` shape live (or at minimum finalized/documented) before it can be meaningfully tested
   end-to-end, but the component work itself (type changes, picker UI) can start in parallel against the
   documented contract.
3. Fix #3 (§4) — `RepeatingRowTable`'s new `combobox` column type + the two call sites. Independent, can land any
   time.
4. Campaign list filtering/search/type badges (§6) — needs `CampaignListItem.ambassadorTypesAllowed` from the
   backend's §7; land alongside or right after Fix #2 since both touch ambassador-type data-fetching patterns.
5. Fix #5 (§5) — phase-template editor. Lowest priority, land last.

## 8. Verification checklist before handing off

- No blue/purple hex or oklch values introduced anywhere in this pass's diffs — only existing theme tokens.
- Every new/changed field renders its error via the existing `FieldErrorMap`/`errors` prop pattern — no new
  validation-display mechanism introduced.
- `LeaderboardPrizesEditor`, `LeaderboardTable`, `AmbassadorStructureStep`, `StructureTab`, `RepeatingRowTable`,
  `CampaignsList`, and `TimelineStep` all still render correctly for an *already-existing* campaign whose
  `rewardConfig`/`groups` were written under the old shape and then passed through the backend's data-migration
  script (§3.5 of the backend guide) — spot-check one migrated campaign end-to-end in the UI, not just a freshly
  created one.
- A campaign list with 25+ campaigns across mixed ambassador types filters/sorts/searches correctly and paginates
  as before.
- Nothing under `app/ambassador/*` or `app/org/ambassadors/applications*` was touched.
- Responsive check: wizard, dashboard tabs, and campaign list all remain usable (no horizontal overflow breaking
  layout, no clipped controls) at a 375px-wide viewport, even though this pass's primary target is desktop.
