# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two confirmed audiences, served with roughly equal weight across the product's public surface:

1. **Organizers** — businesses, schools, communities, and training teams who create and run quiz contests. They build question banks, configure proctoring, manage participants, and review analytics/results from an admin dashboard (`/org/*`). They are the paying customer — real plan/billing and upgrade-prompt UI exists (`PlanBillingTabContent`, `UpgradePromptModal`).
2. **Participants** — people who discover public contests, register (sometimes with paid entry), take proctored quizzes in a live browser session, and see instant results, leaderboards, and downloadable certificates.

## Product Purpose

QuizBuzz is a multi-tenant, real-time quiz and contest platform. It exists to let organizations run fair, verifiable, branded contest programs end-to-end, and to let participants discover and compete in those contests with confidence the result is legitimate.

## Positioning

QuizBuzz's differentiator is owning the **entire contest lifecycle in one platform**: registration (including paid entry), live AI-assisted proctored quiz-taking, real-time leaderboards, and automated certificate issuance — where competitors (Kahoot, Quizizz, Google Forms-based quizzes) typically cover only a slice of that (e.g., live game mechanics, or form-based quiz creation) without integrity/proctoring or the full registration-to-certificate pipeline.

## Operating Context

- Organizers work from an authenticated admin dashboard (`/org/*`): question builder, participant management, live monitoring/proctoring dashboard, contact/messaging tools, certificate template library, org settings, and plan/billing.
- Participants browse public contests (`/contests`), register, and take quizzes in a dedicated live exam session flow (`/quiz/*`) with fullscreen enforcement and webcam-based proctoring checks, auto-save/session recovery if connection drops, then view results, leaderboard rank, and certificates.
- The app is installable as a PWA (desktop, iOS, Android).
- `/org/*` and `/quiz/*` are intentionally excluded from search indexing (private dashboard / live-exam views); `/contests` and its listings are live, dynamic content, not static reference data.

## Capabilities and Constraints

- Competitive, timed quiz contests across multiple categories with prizes/recognition.
- AI-assisted proctoring: webcam monitoring, fullscreen enforcement, presence checks.
- Real-time leaderboards during and after a contest.
- Auto-save of in-progress answers with session recovery.
- Organizer tooling: drag-and-drop question builder, automated participant communication, live proctoring dashboard, exportable analytics, automated certificate generation, white-label options.
- Paid entry is supported per-contest (participant-side), separate from organizer subscription plans (organizer-side billing/upgrade flow already exists in the app).
- No dedicated public `/pricing` page currently exists, though the marketing footer links to one (broken link — flagged for the redesign to either build or remove).

## Brand Commitments

- Name: **QuizBuzz**. Existing wordmark lockup: `frontend/public/quizBuzz-logo.png` (transparent background, teal-green gradient "QUIZ / BUZZ"). Existing icon/app mark: `frontend/public/qbfavicon.png` (the same "Q" mark on a white rounded-square tile, used for favicons/app icons).
- Design tokens already established in `frontend/app/globals.css`: teal primary (`oklch(0.55 0.15 180)` light / `oklch(0.65 0.14 180)` dark), warm neutral background, amber accent, shadcn/Tailwind v4 token system, dark mode supported via `.dark` class.
- Contact: info@ysminfosolution.com, WhatsApp +91 89830 83698.

## Evidence on Hand

- Real, durable facts: the feature list above, the two-audience model, the org dashboard route map, and the actual logo/color assets are all confirmed from the live codebase and `frontend/public/llms.txt`.
- **No real usage numbers, testimonials, customer logos, or case studies exist yet.** The homepage's current stat row (50K+ Active Participants, 500+ Contests Hosted, 98% Satisfaction Rate, 24/7 Support) is placeholder data — kept for now as directional targets only, explicitly not to be presented as verified fact, and to be revisited before real launch.
- `FeaturedContests` on the homepage pulls live data from the contests API; when that API has no data or errors, the section currently shows a bare text message with no branded empty/error state.

## Product Principles

1. Serve organizers and participants with equal top-level weight — neither audience is secondary on the public site.
2. Sell the full lifecycle (register → proctor → compete → certify), not isolated features, since that's the real differentiator.
3. Never present placeholder numbers or invented proof as verified fact; label directional data honestly until real evidence exists.
4. Preserve the existing teal/warm-neutral brand system and the real logo assets rather than introducing a new visual identity.
5. Keep `/org/*` and `/quiz/*` treated as private/dynamic — marketing surfaces link to them but don't index or fake their content.
