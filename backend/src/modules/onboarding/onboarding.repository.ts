import { OnboardingStep, Organization, OrganizationProfile } from "@prisma/client";
import { prisma } from "../../config/db";
import { OnboardingStatusDTO } from "./onboarding.types";

export class OnboardingRepository {

    /**
     * Returns the three onboarding fields + profile for a given org.
     */
    async getStatus(orgId: string): Promise<
        (Pick<Organization, "onboardingCompleted" | "onboardingStep"> & {
            profile: OrganizationProfile | null;
        }) | null
    > {
        return prisma.organization.findUnique({
            where: { id: orgId, isDeleted: false },
            select: {
                onboardingCompleted: true,
                onboardingStep:      true,
                profile:             true,
            },
        });
    }

    /**
     * Advances the org to the next wizard step and upserts profile data.
     * `profileData` is merged on top of any existing profile row.
     */
    async saveStep(
        orgId: string,
        nextStep: OnboardingStep,
        profileData: Record<string, unknown>,
    ): Promise<void> {
        await prisma.$transaction([
            // Advance the current step on the org row
            prisma.organization.update({
                where: { id: orgId },
                data:  { onboardingStep: nextStep },
            }),
            // Merge profile data (upsert — create on first step, update thereafter)
            prisma.organizationProfile.upsert({
                where:  { organizationId: orgId },
                create: { organizationId: orgId, ...profileData },
                update: profileData,
            }),
        ]);
    }

    /**
     * Advances only the onboardingStep column, without touching the profile.
     * Used for steps that have no profile data (e.g. PLAN_SELECTION stub).
     */
    async advanceStep(orgId: string, nextStep: OnboardingStep): Promise<void> {
        await prisma.organization.update({
            where: { id: orgId },
            data:  { onboardingStep: nextStep },
        });
    }

    /**
     * Finds another org by slug (excluding currentOrgId) to check uniqueness.
     */
    async findOtherBySlug(slug: string, currentOrgId: string): Promise<{ id: string } | null> {
        return prisma.organization.findFirst({
            where: {
                slug,
                id: { not: currentOrgId },
                isDeleted: false,
            },
            select: { id: true },
        });
    }

    /**
     * Saves org name & slug for IDENTITY step on Organization model.
     */
    async saveIdentityStep(
        orgId: string,
        orgData: { name: string; slug: string },
    ): Promise<void> {
        await prisma.organization.update({
            where: { id: orgId },
            data: {
                name: orgData.name,
                slug: orgData.slug,
                onboardingStep: OnboardingStep.USE_CASE,
            },
        });
    }

    /**
     * Marks the wizard as fully completed.
     */
    async markCompleted(orgId: string): Promise<void> {
        await prisma.organization.update({
            where: { id: orgId },
            data: {
                onboardingCompleted:   true,
                onboardingCompletedAt: new Date(),
                onboardingStep:        OnboardingStep.COMPLETED,
            },
        });
    }
}
