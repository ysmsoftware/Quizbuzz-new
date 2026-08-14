# Architecture & Design Decisions (ADR) — Ambassador Campaign & Validation System

This document logs all architectural decisions, problem statements, trade-off analyses, and implementation choices made for the **Ambassador Campaign Incentive Architecture & Validation System**.

---

## 1. Context & Problem Statements

During the implementation and testing of the Ambassador Campaign wizard (Step 4: Rewards and Step 3: Ambassador Structure), several UX, validation, and architectural issues were identified:

1. **Cryptic Validation Error Banners**: Saving a wizard step yielded a generic Zod error toast: `"Too small: expected string to have >=1 characters"`, with no inline red field highlights on the specific failing input cell.
2. **Stale Validation on Disabled Features**: Toggling Speed Bonus to **Disabled** (`enabled: false`) still triggered backend validation failures on hidden fields (e.g. required date and milestone threshold).
3. **Redundant Speed Bonus Start Date**: Speed Bonus required admins to manually select a `Campaign Start` date, creating setup friction and potential mismatch with the actual campaign launch date.
4. **Missing Budget Caps & Investment Transparency**: Speed Bonus tiers lacked a cap on the maximum number of winning ambassadors (`maxWinners`), making it impossible to compute exact program budget breakdowns.
5. **Campaign Design Specificity vs. Platform Generality**: The QuizBuzz 5,000-Registration Incentive Program document outlined a specific 50-department, 17-college pilot campaign. The platform needed to support this exact design without hardcoding institution-specific constraints into the core engine.

---

## 2. Key Decisions, Options Explored & Trade-Offs

### Decision 1: Zod Custom Error Messages & Nested Dot-Path Error Mapping

* **Problem**: Backend Zod schemas defaulted to Zod's internal `"Too small..."` message. Furthermore, repeating table column keys (e.g. `goodieLabel`) differed from backend Zod error dot-paths (e.g. `rewardConfig.milestoneTiers.0.goodie.label`), preventing `getCellError` from applying inline red error borders to table cells.
* **Options Explored**:
  * **Option A**: Flatten the backend schema by separating `goodie` into `goodieLabel` and `goodieCashEquivalent` top-level fields.
    * *Trade-Off*: Pollutes domain schema, breaks existing backend API contracts, and degrades code maintainability.
  * **Option B (Chosen)**: Retain clean domain objects `{ goodie: { label, cashEquivalent } }` on the backend with explicit human-readable Zod error messages (`"Goodie name is required"`), and enhance frontend `getCellError` in repeating tables to map nested paths (`goodie.label` / `goodie.cashEquivalent`) to flat column keys (`goodieLabel` / `goodieCashEquivalent`).
* **Rationale**: Option B preserves clean domain design on the server while delivering instant inline field error highlights and clear toast messages to the user.

---

### Decision 2: Conditional Backend Validation via `.superRefine`

* **Problem**: Backend Zod schema for Speed Bonus validated `campaignStartAt`, `milestoneThreshold`, and `tiers` unconditionally. When `enabled` was `false`, default empty values (`""`, `0`, `[]`) caused validation to fail.
* **Options Explored**:
  * **Option A**: Require frontend to send dummy dates and non-zero thresholds even when Speed Bonus is disabled.
    * *Trade-Off*: Stores misleading fallback data in the database and creates brittle frontend logic.
  * **Option B (Chosen)**: Use Zod `.superRefine` on `speedBonusSchema` to short-circuit validation when `enabled === false`:
    ```ts
    .superRefine((data, ctx) => {
      if (!data.enabled) return; // Skip sub-field checks when disabled
      ...
    })
    ```
* **Rationale**: Option B guarantees that disabled campaign features never block draft persistence or publishing, ensuring predictable, state-aware validation.

---

### Decision 3: Automatic Campaign Start Baseline for Speed Bonus

* **Problem**: Asking admins to specify a manual `Campaign Start` date inside the Speed Bonus editor created setup friction and risk of date divergence.
* **Options Explored**:
  * **Option A**: Maintain the manual date picker in the Speed Bonus editor.
    * *Trade-Off*: Duplicate date entry for admins and potential desynchronization with campaign publish date.
  * **Option B (Chosen)**: Remove the manual date picker from the Speed Bonus UI. Make `campaignStartAt` optional in Zod schemas and TypeScript interfaces. At runtime, speed bonus calculations default to the campaign's `startDate` / `publishedAt` timestamp when the campaign goes live.
* **Rationale**: Option B reduces administrative overhead and ensures speed bonus decay windows (e.g. Week 1 / Within 7 days) anchor automatically to actual campaign activation.

---

### Decision 4: Tier Budget Capping (`maxWinners`) & Live Program Investment Calculations

* **Problem**: Admins could set speed bonus amounts but could not specify how many ambassadors could win each tier (e.g. 10 ambassadors for "Fast Starter"), preventing total program budget estimation.
* **Options Explored**:
  * **Option A**: Rely on external spreadsheets for program cost calculations.
    * *Trade-Off*: Poor visibility into campaign financial liabilities during wizard setup.
  * **Option B (Chosen)**: Add optional `maxWinners` property to `SpeedBonusTier`. Compute live tier budget (`maxWinners × bonusAmount`) and render a **Total Speed Bonus Budget** card in `SpeedBonusEditor`, as well as a consolidated **Program Investment Breakdown** in `CampaignSummarySidebar` and `ReviewPublishStep`.
* **Rationale**: Option B gives admins full financial transparency within the wizard without introducing breaking database changes.

---

### Decision 5: Generic Core Platform Architecture vs. Pre-Built System Template

* **Problem**: The QuizBuzz Incentive Program document specified an exact pilot structure (5,000 registrations, 50 departments, 17 colleges, 4 milestone levels, decaying speed bonus, 4 leaderboard cuts).
* **Options Explored**:
  * **Option A**: Hardcode the QuizBuzz pilot rules into the core campaign wizard.
    * *Trade-Off*: Destroys multi-tenant flexibility for other organizations wanting different incentive models.
  * **Option B (Chosen)**: Keep the core wizard generic, and seed a built-in system template (`quizbuzz-5k-pilot-template`) accessible via the 1-click **Use a Saved Template** flow.
* **Rationale**: Option B delivers 100% of the QuizBuzz pilot requirements while maintaining complete generality for all other campaign designs.

---

## 3. Existing vs. Newly Added Components Summary

| Component | Status | Description |
| --- | --- | --- |
| **Zod Schema Core** | Existing | Foundation for request validation in backend controllers. |
| **RepeatingRowTable UI** | Existing | Reusable table editor for multi-row data input. |
| **`country-state-city` Library** | Existing (`^3.2.1`) | Pre-installed package providing worldwide Country, State, and City dropdown data for ambassador registration. |
| **Custom Zod Error Messages** | Newly Added | Human-readable error messages for `.min(1)` string and numeric validations. |
| **Conditional Validation (`.superRefine`)** | Newly Added | Allows saving disabled feature sections without validation errors. |
| **Nested Error Path Resolution** | Newly Added | Maps dot-paths (`goodie.label`) to flat UI table columns (`goodieLabel`). |
| **`maxWinners` Budget Tier Field** | Newly Added | Enables capacity capping and budget estimation per speed bonus tier. |
| **Program Investment Calculators** | Newly Added | Live calculation of Speed Bonus, Leaderboard, and Total Program Investment in summary components. |
| **QuizBuzz 5k Pilot System Template** | Newly Added | Built-in template pre-filled with the 5,000-registration pilot incentive architecture. |

---

## 4. Verification & Validation Summary

* **TypeScript Compilation**:
  * `backend`: `npx tsc --noEmit` — **0 Errors**
  * `frontend`: `npx tsc --noEmit` — **0 Errors**
* **Build Verification**:
  * Backend TypeScript build (`npm run build`) completed cleanly with dist bundle generation.
