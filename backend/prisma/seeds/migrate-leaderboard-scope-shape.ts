/**
 * One-off data rewrite — not a Prisma schema migration. Walks every
 * AmbassadorCampaign and AmbassadorCampaignTemplate row and rewrites each
 * leaderboardPrizes[].scope from the old string-union shape to the new
 * {kind, groupByFieldKeys?} object shape. Run BEFORE deploying the new
 * validator (old-shape scope values fail it) and spot-check a row's
 * rewardConfig before/after in a non-prod database first.
 *
 *   npx ts-node prisma/seeds/migrate-leaderboard-scope-shape.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type OldScope = "INDIVIDUAL_AMBASSADOR" | "DEPARTMENT" | "COLLEGE" | "INTER_COLLEGE_DEPARTMENT";
type NewScope = { kind: "INDIVIDUAL_AMBASSADOR" | "APPLICATION_FIELD_GROUP"; groupByFieldKeys?: string[] };

const SCOPE_MAP: Record<OldScope, NewScope> = {
    INDIVIDUAL_AMBASSADOR: { kind: "INDIVIDUAL_AMBASSADOR" },
    DEPARTMENT: { kind: "APPLICATION_FIELD_GROUP", groupByFieldKeys: ["department"] },
    COLLEGE: { kind: "APPLICATION_FIELD_GROUP", groupByFieldKeys: ["college"] },
    INTER_COLLEGE_DEPARTMENT: { kind: "APPLICATION_FIELD_GROUP", groupByFieldKeys: ["college", "department"] },
};

function migrateRewardConfig(rewardConfig: unknown): { changed: boolean; value: unknown } {
    if (!rewardConfig || typeof rewardConfig !== "object") return { changed: false, value: rewardConfig };
    const cfg = rewardConfig as { leaderboardPrizes?: { scope: unknown }[] };
    if (!Array.isArray(cfg.leaderboardPrizes) || cfg.leaderboardPrizes.length === 0) {
        return { changed: false, value: rewardConfig };
    }

    let changed = false;
    const leaderboardPrizes = cfg.leaderboardPrizes.map((cut) => {
        if (typeof cut.scope === "string" && cut.scope in SCOPE_MAP) {
            changed = true;
            return { ...cut, scope: SCOPE_MAP[cut.scope as OldScope] };
        }
        return cut;
    });

    return { changed, value: { ...cfg, leaderboardPrizes } };
}

async function main() {
    let touched = 0;

    const campaigns = await prisma.ambassadorCampaign.findMany({ select: { id: true, rewardConfig: true } });
    for (const c of campaigns) {
        const { changed, value } = migrateRewardConfig(c.rewardConfig);
        if (!changed) continue;
        await prisma.ambassadorCampaign.update({
            where: { id: c.id },
            data: { rewardConfig: value as Prisma.InputJsonValue },
        });
        touched++;
    }

    const templates = await prisma.ambassadorCampaignTemplate.findMany({ select: { id: true, rewardConfig: true } });
    for (const t of templates) {
        const { changed, value } = migrateRewardConfig(t.rewardConfig);
        if (!changed) continue;
        await prisma.ambassadorCampaignTemplate.update({
            where: { id: t.id },
            data: { rewardConfig: value as Prisma.InputJsonValue },
        });
        touched++;
    }

    console.log(`Rewrote leaderboardPrizes[].scope on ${touched} row(s).`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
