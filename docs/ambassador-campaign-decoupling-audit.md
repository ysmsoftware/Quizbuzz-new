# Ambassador ↔ Campaign Coupling Audit

Grounded in a full read of `backend/prisma/schema.prisma`, `backend/src/modules/ambassador/`,
`backend/src/modules/ambassador-campaign/`, the three planning docs (`docs/ambassador-incentive-program-plan.md`,
`docs/ambassador-backend-implementation-guide.md`, `docs/ambassador-campaign-wizard-plan.md`), and the matching
frontend surface (`frontend/components/features/ambassador/`, `frontend/lib/hooks/*ambassador*`). Written against
the research on mature ambassador programs (Microsoft, Google, GitHub, Notion, Salesforce, AWS) supplied this
session, and against the diagnosis already stated: Ambassador and Campaign should be separate entities, related
indirectly, not hard-wired to one org's pilot brief.

**Verdict: the diagnosis is correct, and specific.** The top-level split (`Ambassador` / `AmbassadorCampaign` /
`AmbassadorCampaignEnrollment` as three separate tables) is already the right shape — that part doesn't need
rebuilding. The coupling isn't in the entity boundary, it's in four things layered *inside* the campaign/reward
system that quietly assume every future organization runs the same kind of program YSM does: a college-and-department
referral drive promoting one quiz.

---

## 1. What's already correctly decoupled — keep this

- `Ambassador` (identity) and `AmbassadorCampaign` (a promotional effort) are separate tables joined through
  `AmbassadorCampaignEnrollment`, exactly the "Ambassador → CampaignParticipation → Campaign" shape the research
  recommends. An ambassador applies once, gets approved once, and self-joins any number of campaigns — nothing here
  special-cases the pilot.
- `PlatformAmbassadorType` + `applicationFields` (JSON field-schema per type) means "what does this org ask an
  applicant" is genuinely config-driven — a Student type and a future Industry/Corporate type can ask for completely
  different fields with zero code changes. This is the one part of the system that already matches the research's
  "type isn't fixed, it's data" principle.
- `reward-calculator.ts` (milestone tiers, speed bonus math) walks `rewardConfig` generically — no hardcoded tier
  count, no hardcoded currency, no special-cased amount. This is genuinely Open/Closed.
- `AmbassadorGroup.groupType` is stored as a plain string on the table itself (schema comment: "config-driven,
  matches how `PlatformAmbassadorType.key` works") — the *intent* here was right, it just doesn't hold at the API
  boundary (see §2.2).

## 2. Where the coupling actually lives

### 2.1 `LeaderboardScope` is a closed, campus-shaped enum baked into four layers

```ts
// backend/src/modules/ambassador-campaign/ambassador-campaign.types.ts:37
export type LeaderboardScope = "INDIVIDUAL_AMBASSADOR" | "DEPARTMENT" | "INTER_COLLEGE_DEPARTMENT" | "COLLEGE";
```

The same four literals are repeated in `ambassador-campaign.validator.ts` (twice — the reward-config schema and the
leaderboard-query schema) and `ambassador.validator.ts`. And the code that actually groups ambassadors for a
leaderboard cut doesn't read the campaign's own `AmbassadorGroup` rows at all — it reads two specific keys off
`Ambassador.applicationData`:

```ts
// backend/src/modules/ambassador-campaign/campaign-stats.ts:69-71
const data = (ambassador.applicationData ?? {}) as Record<string, unknown>;
const college = String(data.college ?? "Unknown");
const department = String(data.department ?? "Unknown");
```

The comment above this function admits it: *"an org whose type uses different field keys falls into 'Unknown'."*
That's the concrete failure mode — a second organization running, say, a corporate referral program with
`applicationData.team`/`applicationData.region` gets every ambassador bucketed into "Unknown" on every leaderboard
cut except the individual one. This is the single largest reason the system can't take a second, differently-shaped
client today. The frontend mirrors the same closed set (`LeaderboardPrizesEditor.tsx`, `LeaderboardTable.tsx` both
hardcode `{ DEPARTMENT: 'Department', COLLEGE: 'College' }` label maps).

### 2.2 `AmbassadorGroupType` claims to be config-driven but is locked to 3 literals at the API boundary

The schema comment says groups are "validated at the API boundary, not a DB enum," implying real flexibility. In
practice:

```ts
// ambassador-campaign.validator.ts:187
groupType: z.enum(["DEPARTMENT", "COLLEGE", "CUSTOM"]),
```

`CUSTOM` exists as an escape hatch for the *group* type, but §2.1's `LeaderboardScope` has no matching `CUSTOM`
option — so even if an org defines a `CUSTOM` group ("Region", "Cohort", "Team"), there is no way to build a
leaderboard cut ranked by it. The group-definition axis and the leaderboard-scope axis were meant to be the same
concept and aren't wired together.

### 2.3 `AmbassadorCampaign` is modeled as "the ambassador program for one quiz," not as a generic campaign

```prisma
// schema.prisma:1137-1165
model AmbassadorCampaign {
  contestId  String?   // required by PublishCampaignSchema at publish time
  ...
  @@unique([contestId])   // one campaign per contest, enforced at the DB level
}
```

`PublishCampaignSchema` requires `contestId` ("Select a quiz or contest to promote before publishing"), and every
downstream DTO (`AvailableCampaignItem`, `MyCampaignItem`, `CampaignStatsDetail`) treats `contestId`/`contestSlug`/
`contestTitle` as always-present, non-null fields once a campaign is live — `ambassador.service.ts` even comments
*"contestId/contest are guaranteed non-null here."* A campaign, as built, **cannot exist without promoting exactly
one Contest (quiz)**. Referral attribution itself is wired the same way — `ContestService.registerParticipant` is
the only place a `referralCode` ever gets resolved. If a future org wants an ambassador campaign that drives, say,
course enrollments, event RSVPs, or plain contact-form submissions rather than quiz registrations, there's no
seam — "what this campaign promotes" and "quiz contest" are the same field.

### 2.4 The campaign timeline is a fixed 6-phase template lifted straight from the pilot brief

```ts
// campaign-timeline.ts:9-16
const PHASE_TEMPLATE = [
  { key: "onboarding_launch", label: "Ambassador Onboarding & Launch", fraction: 0.125 },
  { key: "early_bird",        label: "Early Bird",                     fraction: 0.125 },
  { key: "steady_push",       label: "Steady Push",                    fraction: 0.25  },
  { key: "regular_deadline",  label: "Regular Deadline",                fraction: 0.125 },
  { key: "final_call",        label: "Final Call",                      fraction: 0.125 },
  { key: "buffer_close",      label: "Buffer & Registration Close",     fraction: 0.25  },
];
```

This *is* proportionally scaled to any campaign length (the comment is right that it's not hardcoded week counts),
but the six phase names and their relative weights are the pilot brief's own structure, applied unconditionally to
every campaign any org ever creates. There's no way for a different program shape (e.g. Microsoft's
milestone-based model, or a program with no phased timeline at all) to opt out of these six specific phases.

### 2.5 The pilot brief is hardcoded as a permanent, undeletable system template — the clearest single example

```ts
// ambassador-campaign.service.ts:456-524
// Always include the built-in system template for QuizBuzz 5,000-Registration Pilot
const systemTemplate: TemplateResult = {
  id: "quizbuzz-5k-pilot-template",
  name: "QuizBuzz 5,000-Registration Pilot Campaign",
  rewardConfig: { /* ...every tier amount, every goodie, every prize from the YSM brief, verbatim... */ },
  groups: [
    { groupType: "DEPARTMENT", name: "Departments (50)", ambassadorTarget: 50, registrationTarget: 100 },
    { groupType: "COLLEGE",    name: "Colleges (17)",    ambassadorTarget: 17, registrationTarget: 100 },
  ],
  ...
};
```

`listTemplates` unconditionally prepends this object — with the exact ₹15/₹18/₹20 per-registration rates, the
"Bluetooth Earbuds," "Free Premium Internship," and 50-department/17-college numbers from the sample document —
to **every organization's** template list, and `deleteTemplate`/`instantiateTemplate` both special-case the literal
string `"quizbuzz-5k-pilot-template"`. This is the most literal instance of the coupling: one client's specific
business content isn't just an *inspiration* for the config shape (which would be fine), it's shipped as
platform-level code every tenant sees.

## 3. Root cause

Everything in §1 (the entity split, the type-catalog system, the reward-tier math) was built against the right
abstraction: "a campaign has a config, walk the config generically." Everything in §2 was built against the
YSM brief's *specific taxonomy* — college, department, quiz contest, a six-phase academic-term calendar — and that
taxonomy leaked into enum literals, Zod schemas, a grouping function's field lookups, and eventually a hardcoded
template object, instead of staying data. The pattern in every one of the five issues above is the same: a concept
that should have been "whatever `AmbassadorGroup` rows this org defines" or "whatever this campaign is configured
to promote" got hardcoded as a fixed literal set instead, at exactly the layer where the research says a second
client's differently-shaped program would break.

## 4. What "indirect, not direct" would actually look like here

Matching the "Ambassador and Campaign are separate entities, related indirectly" framing:

- **Leaderboard scope becomes campaign-defined, not platform-defined.** Replace the closed `LeaderboardScope`
  union with a reference to the campaign's own `AmbassadorGroup.groupType` values (already stored per-campaign) plus
  a fixed `INDIVIDUAL_AMBASSADOR` baseline. `groupKeyAndLabel` stops reading `applicationData.college`/`.department`
  by name and instead reads whatever field key the campaign's group definition says to group by — the grouping
  becomes a property of the campaign's config, not a hardcoded field-name lookup.
- **`contestId` becomes one of several "what this campaign promotes" targets, not a mandatory 1:1 FK.** Something
  like a `targetType: "CONTEST" | "EXTERNAL_LINK" | ...` + `targetId`/`targetUrl` pair, so referral capture can
  eventually attach to more than a quiz registration, without touching the Ambassador/Enrollment tables at all.
  Smallest viable version: keep `contestId` but make it genuinely optional end-to-end (stop asserting
  non-null downstream) and let a campaign's "promoted thing" be a small pluggable reference.
- **The 6-phase timeline template becomes a default, not a constant.** Either let `PHASE_TEMPLATE` be edited/replaced
  per campaign (stored the same way `rewardConfig` already is — JSON, walked generically) or, at minimum, ship it as
  seed data an org can override rather than a code constant every campaign is forced through.
- **The pilot brief moves out of code and into a real, org-scoped template row.** Same `AmbassadorCampaignTemplate`
  table that already exists for custom templates — seed YSM's pilot as a normal row scoped to YSM's
  `organizationId`, delete the `systemTemplate`/`"quizbuzz-5k-pilot-template"` special-casing entirely. Any other
  org simply never sees it, and YSM's own copy is editable/deletable like any other template instead of being
  permanently wired into the service.

## 5. What this audit deliberately does not do

No code has been changed. This is the analysis pass — confirming the coupling is real, locating every instance of
it with file:line references, and sketching the shape of a fix. Before touching code, worth deciding: fix all five
issues in one pass, or land them independently (§2.5 is the cheapest/highest-value fix — it's a pure deletion plus
a seed row, with zero schema change); and whether "what a campaign promotes" (§2.3) is worth generalizing now or
worth deferring until an actual second organization's requirements are known, since building that abstraction
against a guess is its own coupling risk.
