import { OnboardingStep } from "@prisma/client";
import { prisma } from "../../config/db";
import { ForbiddenError, NotFoundError, BadRequestError } from "../../error/http-errors";
import { OnboardingRepository } from "./onboarding.repository";
import { STEP_SCHEMAS, StepName } from "./onboarding.validator";
import { OnboardingStatusDTO, PlanOption } from "./onboarding.types";

// Static step order used to determine the "next" step after saving
const STEP_ORDER: OnboardingStep[] = [
    OnboardingStep.NOT_STARTED,
    OnboardingStep.IDENTITY,
    OnboardingStep.USE_CASE,
    OnboardingStep.ATTRIBUTION,
    OnboardingStep.CONTACT_LOCALE,
    OnboardingStep.PLAN_SELECTION,
    OnboardingStep.COMPLETED,
];

function nextStep(current: OnboardingStep): OnboardingStep {
    const idx = STEP_ORDER.indexOf(current);
    if (idx === -1 || idx >= STEP_ORDER.length - 1) return OnboardingStep.COMPLETED;
    return STEP_ORDER[idx + 1] as OnboardingStep;
}

// Static plan stub — will be replaced by real ops-subscription call later
const STATIC_PLANS: PlanOption[] = [
    {
        slug:        "free",
        name:        "Free",
        description: "Perfect for getting started with unlimited contests and up to 100 participants.",
        price:       0,
        currency:    "INR",
        features: [
            "Unlimited contests",
            "Up to 100 participants per contest",
            "Basic proctoring",
            "PDF certificates",
            "WhatsApp & email notifications",
        ],
    },
];

export class OnboardingService {
    constructor(private readonly repo: OnboardingRepository) {}

    // ─── Guard: caller must be OWNER of the org ───────────────────────────────

    private async assertOwner(adminId: string, orgId: string): Promise<void> {
        const membership = await prisma.orgMember.findFirst({
            where: { adminId, organizationId: orgId, isActive: true },
            select: { role: true },
        });
        if (!membership) throw new ForbiddenError("You are not a member of this organization");
        if (membership.role !== "OWNER") throw new ForbiddenError("Only the organization owner can manage onboarding");
    }

    // ─── GET /onboarding/status ───────────────────────────────────────────────

    async getStatus(adminId: string, orgId: string): Promise<OnboardingStatusDTO> {
        await this.assertOwner(adminId, orgId);

        const row = await this.repo.getStatus(orgId);
        if (!row) throw new NotFoundError("Organization not found");

        return {
            completed:   row.onboardingCompleted,
            currentStep: row.onboardingStep,
            profile:     row.profile
                ? {
                    primaryUseCase:           row.profile.primaryUseCase,
                    useCaseOther:             row.profile.useCaseOther,
                    sizeBucket:               row.profile.sizeBucket,
                    expectedContestsPerMonth: row.profile.expectedContestsPerMonth,
                    expectedParticipants:     row.profile.expectedParticipants,
                    heardAboutSource:         row.profile.heardAboutSource,
                    heardAboutOther:          row.profile.heardAboutOther,
                    primaryContactName:       row.profile.primaryContactName,
                    primaryContactPhone:      row.profile.primaryContactPhone,
                    primaryContactEmail:      row.profile.primaryContactEmail,
                    country:                  row.profile.country,
                    state:                    row.profile.state,
                    city:                     row.profile.city,
                    timezone:                 row.profile.timezone,
                    preferredCurrency:        row.profile.preferredCurrency,
                    gstNumber:                row.profile.gstNumber,
                    billingAddress:           row.profile.billingAddress,
                    marketingOptIn:           row.profile.marketingOptIn,
                }
                : null,
        };
    }

    // ─── PATCH /onboarding/step/:step ─────────────────────────────────────────

    async saveStep(
        adminId: string,
        orgId: string,
        stepName: string,
        body: unknown,
    ): Promise<void> {
        await this.assertOwner(adminId, orgId);

        const upperStep = stepName.toUpperCase() as StepName;
        const schema = STEP_SCHEMAS[upperStep];
        if (!schema) throw new BadRequestError(`Unknown onboarding step: ${stepName}`);

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            throw new BadRequestError(parsed.error.issues[0]?.message ?? "Validation failed");
        }

        const data = parsed.data;

        if (upperStep === "IDENTITY") {
            // Identity data goes on the Organization row (logoUrl/website), not profile
            await this.repo.saveIdentityStep(orgId, data as { logoUrl?: string; website?: string });
            return;
        }

        if (upperStep === "PLAN_SELECTION") {
            // Plan selection is stubbed — no plan data lives on the profile table.
            // Just advance the step to COMPLETED so the wizard can call /complete.
            await this.repo.advanceStep(orgId, OnboardingStep.COMPLETED);
            return;
        }

        // All other steps write to OrganizationProfile
        const next = nextStep(OnboardingStep[upperStep as keyof typeof OnboardingStep]);
        await this.repo.saveStep(orgId, next, data as Record<string, unknown>);
    }

    // ─── POST /onboarding/complete ────────────────────────────────────────────

    async complete(adminId: string, orgId: string): Promise<void> {
        await this.assertOwner(adminId, orgId);
        await this.repo.markCompleted(orgId);
    }

    // ─── GET /onboarding/plans ────────────────────────────────────────────────

    getPlans(): PlanOption[] {
        return STATIC_PLANS;
    }
}
