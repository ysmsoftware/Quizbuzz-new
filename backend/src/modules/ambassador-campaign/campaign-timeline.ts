import { CampaignPhase, CampaignPhaseTemplateEntry } from "./ambassador-campaign.types";

/**
 * Config-driven phase breakdown (§6 of docs/ambassador-campaign-wizard-plan.md) — a fraction
 * of the total campaign duration per phase, not hardcoded week counts, so it scales to a
 * campaign of any length instead of only working for the original 8-week example. Ordered;
 * fractions must sum to 1. This is now just the default — a campaign can override it via
 * AmbassadorCampaign.phaseTemplate (§6, campaign-engine-backend-implementation-guide.md).
 */
const DEFAULT_PHASE_TEMPLATE: CampaignPhaseTemplateEntry[] = [
    { key: "onboarding_launch", label: "Ambassador Onboarding & Launch", fraction: 0.125 },
    { key: "early_bird", label: "Early Bird", fraction: 0.125 },
    { key: "steady_push", label: "Steady Push", fraction: 0.25 },
    { key: "regular_deadline", label: "Regular Deadline", fraction: 0.125 },
    { key: "final_call", label: "Final Call", fraction: 0.125 },
    { key: "buffer_close", label: "Buffer & Registration Close", fraction: 0.25 },
];

/**
 * Pure function — same "walk generically, never special-case a count" spirit as
 * reward-calculator.ts and campaign-capacity.ts. Called on create/update whenever
 * startDate/endDate change while they're still editable, and once at publish time as part
 * of validating the campaign is complete.
 */
export function generateCampaignPhases(
    startDate: Date,
    endDate: Date,
    template: CampaignPhaseTemplateEntry[] = DEFAULT_PHASE_TEMPLATE,
): CampaignPhase[] {
    const totalMs = endDate.getTime() - startDate.getTime();
    if (totalMs <= 0) return [];

    const phases: CampaignPhase[] = [];
    let cursor = startDate.getTime();
    for (const tpl of template) {
        const durationMs = totalMs * tpl.fraction;
        const startsAt = new Date(cursor);
        cursor += durationMs;
        phases.push({ key: tpl.key, label: tpl.label, startsAt: startsAt.toISOString(), endsAt: new Date(cursor).toISOString() });
    }

    // Floating-point rounding across the fractions can leave the last phase a few ms short
    // of endDate — snap it exactly, since "the campaign timeline ends when it ends" matters
    // more here than fraction precision.
    const lastPhase = phases[phases.length - 1];
    if (lastPhase) lastPhase.endsAt = endDate.toISOString();

    return phases;
}
