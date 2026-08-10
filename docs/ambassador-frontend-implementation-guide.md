# Ambassador Program — Frontend Implementation Guide

**Audience: an AI coding agent (Claude Code) building the `Quizbuzz-new/frontend` side of this feature in
its own session, in parallel with a separate backend session.** This document is self-contained. It
assumes the API surface described in `ambassador-backend-implementation-guide.md` §5 exists or will exist
with those exact routes/shapes — treat that route table as the contract. If the live backend isn't ready
yet, build against it with the response shapes described here and adjust only if the real backend
diverges from the documented contract (flag the divergence, don't silently guess).

**Out of scope for this session:** the `quizbuzz-ops-next` repo (a separate codebase — the Ambassador
Type catalog CRUD screen lives there, not here).

**Ground truth this doc is built from:** `frontend/components/ui/*` (the full shadcn/ui set already
installed), `frontend/app/globals.css` (theme tokens), `frontend/components/features/contests/PublicLinkCard.tsx`
(the share-card pattern to extend), `frontend/lib/hooks/useContacts.ts` + `frontend/lib/api/crm.api.ts`
(the org-admin paginated-list data-layer pattern), `frontend/lib/services/registration-service.ts` (the
public/participant-facing data-layer pattern), `frontend/components/ui/pagination-bar.tsx` (reuse as-is,
don't rebuild), `frontend/app/contests/[slug]/register/page.tsx` (the mobile-first, step-based, `react-hook-form`
+ `zodResolver` public form pattern to mirror for the application form).

---

## 1. Design constraints — read before writing any component

**Reuse the existing theme. Do not add a new color palette, and do not use blue or purple.** Every color
in this feature comes from the CSS variables already defined in `app/globals.css`:
`--primary` (a teal/cyan, not blue), `--accent` (amber/gold), `--secondary`, `--muted`, `--destructive`,
`--success`, `--warning`, `--border`, plus the `--chart-1`..`--chart-5` set if a leaderboard visualization
ever wants distinct series colors. All of these are already blue/purple-free — the constraint is
automatically satisfied by never introducing a raw hex/oklch color and always using the Tailwind classes
that map to these vars (`bg-primary`, `text-accent-foreground`, `border-border`, etc.). Pink is fine if a
genuine accent moment calls for it (per Austin's note) but isn't required — reach for `--accent` first
before adding anything new. If a leaderboard "gold/silver/bronze" moment wants a color the palette
doesn't have, use `--warning` (amber) for gold-ish accents and neutral `--muted`/`--secondary` tones for
2nd/3rd rather than inventing new hues.

**Mobile-first, genuinely, not just "responsive."** The ambassador dashboard and the share flow are the
highest-traffic mobile surfaces in this whole feature — an ambassador is checking their referral count and
sharing a link from their phone between classes, not at a desk. Build every ambassador-facing page
mobile-first: base Tailwind classes target the mobile layout, `sm:`/`md:` breakpoints layer on
desktop-only enhancements, never the reverse. The org-admin campaign/reporting screens can follow the
existing org-admin desktop-oriented conventions (see `app/org/contacts` for precedent) since that audience
is on a laptop reviewing applications, not scanning on a phone.

**Reuse shadcn/ui components before building anything new.** The full set is already installed in
`components/ui/`: `Card`, `Button`, `Input`, `Select`, `Dialog`, `Sheet` (better than `Dialog` for
mobile-first bottom-sheet interactions — prefer it for the ambassador-facing flows), `Badge`, `Tabs`,
`Table`, `Progress` (for milestone-tier progress bars), `Avatar`, `Skeleton` (loading states), `Empty`
(empty states), `Form`/`Field`/`Label` (react-hook-form integration), `PaginationBar` (custom wrapper, use
exactly as `useContacts` + a list page already do — don't rebuild pagination). Only create a new component
when nothing in this list covers the need, and when you do, it goes in `components/features/ambassador/`
(org-admin + ambassador-shared pieces) matching the existing `components/features/contests/` convention —
not a new top-level folder.

**Keep components small.** Nothing here should turn into a 500-line page component. If a page is doing
more than "fetch via a hook, lay out 3-5 focused child components," split it. `PublicLinkCard.tsx` (§6) is
the right size reference — a focused, single-responsibility component, not a kitchen sink.

---

## 2. Data layer

Two different layers already exist in this codebase for two different audiences — keep using both, don't
collapse them:

- **`lib/api/*.api.ts`** — org-admin, authenticated via the existing org session, thin wrappers around
  `apiClient` (see `crm.api.ts` for the exact shape: typed request/response, no business logic). Add
  `lib/api/ambassador-campaign.api.ts` here, covering every `/api/v1/org/ambassadors*` route from the
  backend doc §5.3.
- **`lib/services/*.ts`** — public/participant-facing, used by pages that aren't behind the org-admin auth
  wall (see `registration-service.ts`). Add `lib/services/ambassador-service.ts` here, covering
  `/api/v1/public/ambassador/*` and `/api/v1/ambassador/*` (the ambassador's own authenticated session is
  a different token from the org-admin session, but it's still "not the org-admin dashboard," so it
  belongs in this layer, matching how `registration-service.ts` handles the participant's own
  `contactToken` session today).

**Hooks**, one per meaningful data need, following `useContacts.ts`'s exact shape (`useQuery` +
`keepPreviousData` for paginated lists, `useMutation` + `invalidateQueries` for writes, a plain returned
object of `{ data, pagination, isLoading, isError, mutate, mutateLoading }` — not raw react-query objects
leaking into components):

```
lib/hooks/useAmbassadorTypes.ts          # public — GET /public/ambassador/types
lib/hooks/useAmbassadorApply.ts          # public — POST /public/ambassador/apply (+ upload-proof)
lib/hooks/useAmbassadorAuth.ts           # public — request-otp / verify-otp
lib/hooks/useAmbassadorMe.ts             # ambassador-authed — GET /ambassador/me
lib/hooks/useAmbassadorCampaigns.ts      # ambassador-authed — available + mine + join
lib/hooks/useAmbassadorCampaignStats.ts  # ambassador-authed — single-campaign stats + leaderboard
lib/hooks/useOrgAmbassadorApplications.ts # org-admin — applications queue + approve/reject
lib/hooks/useOrgAmbassadorCampaigns.ts    # org-admin — campaign CRUD
lib/hooks/useOrgAmbassadorReport.ts       # org-admin — per-campaign report + export
```

Query keys follow the existing convention (`['contacts', filters]`) — e.g. `['ambassador-campaigns',
'mine']`, `['org-ambassador-applications', filters]`. Invalidate the applications-queue query on
approve/reject the same way `createContactMutation` invalidates `['contacts']`.

---

## 3. Route map

### 3.1 Public (unauthenticated) — mobile-first

- `app/ambassador/[orgSlug]/apply/page.tsx` — the application form (§4). Reached via the org's own
  ambassador-program link. If the backend resolves the feature as disabled for this org, this route
  renders Next.js's standard `not-found` — no custom "feature unavailable" messaging, matching the
  backend's plain-404 contract.
- `app/ambassador/[orgSlug]/login/page.tsx` — email → OTP, mirroring the `register/page.tsx` OTP-step UI
  (same `InputOTP` component, same resend/countdown pattern) but issuing/verifying against the
  ambassador auth endpoints instead of the participant ones.

### 3.2 Ambassador-authenticated — mobile-first, this is the primary surface

- `app/ambassador/[orgSlug]/dashboard/page.tsx` — routes internally by `status` from `useAmbassadorMe`:
  `PENDING`/`REJECTED`/`SUSPENDED` render the corresponding status view inline (no separate route needed
  for these — they're not going to get deep-linked or bookmarked differently); `APPROVED` renders the
  actual dashboard: available-campaigns list + joined-campaigns list, each joined campaign as a
  `<CampaignCard>` (§5).
- `app/ambassador/[orgSlug]/dashboard/campaigns/[campaignId]/page.tsx` — the expanded single-campaign
  view: full stats, leaderboards, share assets. Deep-linkable/bookmarkable on purpose — an ambassador
  should be able to bookmark "my stats for this specific contest."

### 3.3 Org-admin (existing `app/org/*` conventions, desktop-oriented is fine)

- `app/org/ambassadors/page.tsx` — landing tab set (`Tabs` component): Applications / Campaigns.
- `app/org/ambassadors/applications/[id]/page.tsx` — single application detail + approve/reject, if the
  queue list doesn't fit approve/reject inline in a row (recommend inline row actions with a confirm
  `Dialog`, matching how other org-admin list actions in this codebase already work — only build the
  detail page if the proof-document review genuinely needs more room than a `Sheet` slide-over gives you).
- `app/org/ambassadors/campaigns/page.tsx` — campaign list.
- `app/org/ambassadors/campaigns/new/page.tsx` and `.../[id]/edit/page.tsx` — campaign create/edit form
  (§7).
- `app/org/ambassadors/campaigns/[id]/report/page.tsx` — per-campaign report + export button.

Nav: add an "Ambassadors" item to the existing org-admin sidebar/nav config (find it via whatever
`app/org/layout.tsx` renders — mirror the existing nav-item shape exactly), gated client-side on the same
`ambassador_program_enabled` flag the backend already gates the API on (fetch this once, e.g. via
`useOrganization()`'s existing org-settings read if that already surfaces feature flags, or a small
dedicated `useFeatureFlag('ambassador_program_enabled')` hook if it doesn't yet — check `useOrganization.ts`
first before adding a new hook). The nav item simply doesn't render when the flag is off, consistent with
the backend's "no signal" posture.

---

## 4. Public application form — dynamic fields off `applicationFields`

Structure mirrors `contests/[slug]/register/page.tsx`: `react-hook-form` + `zodResolver`, but the Zod
schema for the type-specific section is **built at runtime**, not authored statically, since it depends on
which type the applicant picks. Shape:

```tsx
// components/features/ambassador/DynamicApplicationFields.tsx
interface ApplicationFieldDef {
  key: string;
  label: string;
  type: "TEXT" | "EMAIL" | "PHONE" | "NUMBER" | "SELECT" | "DATE";
  required: boolean;
  options?: string[];
}

// Given an ApplicationFieldDef[], renders the right shadcn/ui input per field.type (Input for
// TEXT/EMAIL/PHONE/NUMBER/DATE with the right `type` attr, Select for SELECT with `options` as items),
// and exposes a helper `buildZodSchemaFor(fields: ApplicationFieldDef[])` that constructs the
// runtime-generated Zod object schema (z.string().min(1) per required TEXT, z.enum(options) per SELECT,
// etc.) — call this once when the applicant picks a type, feed it into a *second* zodResolver alongside
// the fixed baseline schema (name/email/phone), or merge both into one z.object() before resolving.
```

Flow on the page: fetch `useAmbassadorTypes(orgSlug)` on mount → render the type `Select` → on change,
swap in `<DynamicApplicationFields fields={selectedType.applicationFields} />` and update the resolver →
proof upload input labeled with `selectedType.proofFieldLabel`, using whatever upload flow the backend
doc's §9 settles on (presigned PUT, most likely — upload directly to the returned URL client-side, then
submit `{storageKey, url}` with the rest of the form, mirroring how proctoring evidence upload already
works if that's client-driven too). Submit → `POST /apply` → success screen with a "we'll email you"
message, matching the confirmation-email copy from the backend doc.

This component owns exactly one job (render + validate a dynamic field set) and takes the field
definitions as a prop — it has zero knowledge of ambassadors specifically, which is what makes it
reusable if a future part of the product ever needs another admin-defined dynamic form.

---

## 5. `CampaignCard` — the dashboard's core reusable unit

```
components/features/ambassador/CampaignCard.tsx        # summary card, used in the "mine" list
components/features/ambassador/CampaignStatsPanel.tsx   # expanded stats (tier/progress/speed-bonus/reward)
components/features/ambassador/LeaderboardTable.tsx     # reusable, takes scope+rows, used both on the
                                                          # ambassador dashboard and the org-admin report
components/features/ambassador/MilestoneProgress.tsx    # thin wrapper around <Progress> + tier labels
```

`CampaignCard` (Card-based, matches `PublicLinkCard`'s visual weight): campaign name/contest title,
`MilestoneProgress` bar, current tier label, a "View details" link to the campaign detail route (§3.2),
and the `ShareCampaignCard` (§6) either inline or one tap away — decide based on how busy the card looks
once built; if the share block makes the card too tall for a mobile list, keep it one tap away on the
detail page instead and keep the list card to a compact summary. Err toward the compact list + detail-page
split; a list of 1-3 campaigns doesn't need everything visible at once.

`LeaderboardTable` takes `{ scope, rows, currentAmbassadorId }` and highlights the current ambassador's own
row if present — one component, reused for all four `LeaderboardScope` values and for both the ambassador
view and the org-admin report view (just pass `currentAmbassadorId={undefined}` on the org-admin side).
This is the DRY point the backend doc's §6.3 already flagged on the API side — mirror it on the frontend
so there's one rendering implementation too.

---

## 6. Share mechanism — client-driven only, no backend messaging call

This is the one piece with an explicit hard constraint: **sharing is entirely client-side.** The backend
never sends a message on the ambassador's behalf — it only serves the campaign's `shareTemplates`
(`{whatsappText, instagramText, posterImageUrl}`, already fetched as part of the campaign data) and the
ambassador's own `referralCode`/link. Everything from "user taps Share" onward happens in the browser,
using the device's own installed apps.

Build `ShareCampaignCard.tsx` as a direct extension of the existing `PublicLinkCard.tsx` pattern — same
copy-to-clipboard + `navigator.share` shape, adding one thing `PublicLinkCard` doesn't have: a
WhatsApp-specific deep link, since that's explicitly the primary channel the pilot brief's own strategy
calls for.

```tsx
// components/features/ambassador/ShareCampaignCard.tsx
interface ShareCampaignCardProps {
  referralLink: string;          // {frontendUrl}/contests/{slug}/register?ref={code}, built by the caller
  whatsappText: string;          // from campaign.shareTemplates, with {referralLink} already interpolated
  posterImageUrl?: string;
}

function buildWhatsAppUrl(text: string): string {
  // wa.me deep link — opens the WhatsApp app directly on mobile with the message pre-filled and ready
  // to send to a chosen contact; falls back to WhatsApp Web on desktop. No API call, no backend
  // involvement, purely a browser navigation to an external URL.
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

// Buttons:
// - "Share via WhatsApp" -> window.open(buildWhatsAppUrl(whatsappText), '_blank')
// - "Copy message" -> navigator.clipboard.writeText(whatsappText) — for pasting into Instagram/anywhere
//   WhatsApp's deep link doesn't reach, satisfying "copy the message" for any platform
// - "Share..." (native share sheet, mobile only, feature-detect navigator.share) -> navigator.share({
//     title: campaignName, text: whatsappText, url: referralLink
//   }) — on a phone this opens the OS-level share sheet (WhatsApp, Instagram, SMS, etc. all as options),
//   which is the most direct way to satisfy "third-party app opens with the message ready to share on
//   whichever platform they choose"
// - "Copy link" -> navigator.clipboard.writeText(referralLink), same pattern as PublicLinkCard
// - If posterImageUrl is set, render it with a "Download poster" link (plain <a download>, no upload
//   logic needed client-side, the image already lives at a URL)
```

No new backend endpoint is needed for any of this — it's pure client-side URL construction and browser
APIs against data the campaign-fetch call already returned. Do not add a "log that I shared" API call
either unless a later requirement asks for it explicitly; it's not part of what was asked for here, and
speculative telemetry endpoints aren't worth the coordination cost with the backend session for this pass.

---

## 7. Org-admin campaign form — reward config editor

The backend stores `rewardConfig` as the JSON shape from the backend doc §6.4. The org-admin form must
**never expose raw JSON** — build three editable sections, each a small repeating-row table (`Table`
component + inline `Input`/`Select` cells, an "Add row" button, a trash-icon remove button per row — this
exact interaction already exists in this codebase's `OrgOverridesPanel`-style patterns and the question
builder likely used elsewhere for quizzes; check `components/questions/` for an existing repeating-row
editor before building this from scratch, it's very likely the closest precedent in this codebase):

1. **Milestone tiers** — rows of `{minRegistrations, maxRegistrations, amountPerRegistration, goodie
   label?, goodie cash-equivalent?}`.
2. **Speed bonus** — a toggle (`Switch`) + `campaignStartAt` date picker (`DatePicker`, already installed)
   + `milestoneThreshold` number input + rows of `{withinDays, bonusAmount, label}`.
3. **Leaderboard prizes** — one collapsible section per `LeaderboardScope` (four fixed sections, not user-
   addable — the four scopes are fixed by the backend type), each with its own rank-reward rows.

Assemble the final `RewardConfig` JSON on submit from this structured form state — the form's internal
state can be a plain object shaped like `RewardConfig` directly (no need for a separate "form model" vs.
"API model" translation layer here, the shapes are the same).

Same treatment for `shareTemplates`: two `Textarea` fields (WhatsApp text, Instagram text) with a small
inline hint that `{referralLink}` will be substituted, plus an image upload for the poster (reuse whatever
existing image-upload component this codebase already has for certificate templates / contest branding —
check `components/admin/` or `certificate-templates` related components before building a new uploader).

---

## 8. Pagination and list UX

Every list screen (applications queue, campaigns list, per-campaign report, leaderboards) uses
`PaginationBar` exactly as installed, wired to the hook's `page`/`totalPages`/`total` the same way
`useContacts` + its consuming page already do it — no new pagination component. Loading state:
`Skeleton` rows matching the row height of the real content (check an existing list page for the exact
skeleton-row convention). Empty state: the `Empty` component (already installed) — e.g. "No applications
yet" / "No campaigns yet, create one to get started."

---

## 9. Build order

1. Data layer skeletons (§2) — API/service wrapper functions can be written against the backend doc's
   documented contract before the real backend is live; they'll just 404 until the backend session
   catches up, which is fine for parallel development.
2. `DynamicApplicationFields` (§4) + the public application page — no auth dependency, can be fully built
   and visually verified against mocked `ApplicationFieldDef[]` data immediately.
3. OTP login page (§3.1) — mirror `register/page.tsx`'s OTP step closely, this is largely copy-adapt.
4. Org-admin applications queue + approve/reject (§3.3) — build against seeded/mocked data first.
5. Org-admin campaign form (§7) — the reward-config editor is the most involved UI piece in this whole
   feature; budget the most time here.
6. `CampaignCard`/`CampaignStatsPanel`/`LeaderboardTable`/`MilestoneProgress` (§5) — build against mocked
   stats responses shaped exactly like the backend doc's §5.2 `/campaigns/:id/stats` contract.
7. `ShareCampaignCard` (§6) — no backend dependency at all beyond data already fetched in step 6, build
   and test the WhatsApp/native-share/copy interactions directly in a browser (native share sheet won't
   fire in most desktop browsers — verify on an actual mobile device or mobile emulation with a real
   `navigator.share` implementation, not just a desktop Chrome devtools mobile viewport, since some
   desktop browsers silently no-op `navigator.share`).
8. Wire everything to the real backend once it's live; replace mocked data, verify every response shape
   matches what was assumed.
9. Nav integration (§3.3's flag-gated "Ambassadors" item) — do this last, once the section it's gating is
   actually complete enough to be worth exposing.

## 10. Verification checklist before handing off

- Every ambassador-facing page passes a genuine mobile-viewport check (375px width) with no horizontal
  scroll, no overlapping text, and every tap target at least 44px.
- No blue or purple appears anywhere — grep the new files for raw hex/oklch color values; there should be
  none, only Tailwind theme classes.
- `navigator.share` and the `wa.me` link both verified on an actual phone (or mobile browser emulator with
  real API support), not assumed from reading the code.
- The dynamic application form correctly rejects a submission missing a required type-specific field
  before it ever reaches the network call.
- Pagination state (page/limit/sort) survives a page refresh where reasonable (URL search params, matching
  how existing paginated org-admin lists already persist filters — check `app/org/contacts/page.tsx` for
  the convention).
- No component file in `components/features/ambassador/` exceeds roughly 200 lines; split if it does.
