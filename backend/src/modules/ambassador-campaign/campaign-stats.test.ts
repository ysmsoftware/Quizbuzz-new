import { AmbassadorStatus } from "@prisma/client";
import { computeLeaderboardGroups, findLeaderboardScopeParentKey } from "./campaign-stats";
import { AmbassadorCampaignRepository } from "./ambassador-campaign.repository";
import { LeaderboardScope } from "./ambassador-campaign.types";

jest.mock("../../common/ambassador-types", () => ({
    getAmbassadorTypeByKey: jest.fn(),
}));
import { getAmbassadorTypeByKey } from "../../common/ambassador-types";
const mockGetAmbassadorTypeByKey = getAmbassadorTypeByKey as jest.Mock;

function fakeEnrollment(id: string, ambassadorId: string, applicationData: Record<string, string>, registrationCount: number) {
    return {
        id,
        ambassadorId,
        status: AmbassadorStatus.APPROVED,
        ambassador: { id: ambassadorId, applicationData },
        registrationCount,
    };
}

function fakeRepo(enrollments: ReturnType<typeof fakeEnrollment>[]): AmbassadorCampaignRepository {
    const counts = new Map(enrollments.map((e) => [e.id, e.registrationCount]));
    return {
        listEnrollmentsForCampaign: jest.fn().mockResolvedValue(enrollments),
        countReferralsForEnrollments: jest.fn().mockResolvedValue(counts),
    } as unknown as AmbassadorCampaignRepository;
}

describe("computeLeaderboardGroups scoping", () => {
    const deptScope: LeaderboardScope = { kind: "APPLICATION_FIELD_GROUP", groupByFieldKeys: ["department"] };

    it("merges same-named departments across colleges when unfiltered — the bug this feature fixes downstream", async () => {
        const repo = fakeRepo([
            fakeEnrollment("e1", "a1", { college: "SRM", department: "CSE" }, 10),
            fakeEnrollment("e2", "a2", { college: "VIT", department: "CSE" }, 5),
        ]);
        const groups = await computeLeaderboardGroups(repo, "campaign-flat-1", deptScope);
        expect(groups).toHaveLength(1);
        expect(groups[0]!.registrationCount).toBe(15);
        expect(groups[0]!.ambassadorIds.sort()).toEqual(["a1", "a2"]);
    });

    it("scopes to one college when a filter is given, instead of merging", async () => {
        const repo = fakeRepo([
            fakeEnrollment("e1", "a1", { college: "SRM", department: "CSE" }, 10),
            fakeEnrollment("e2", "a2", { college: "VIT", department: "CSE" }, 5),
        ]);
        const groups = await computeLeaderboardGroups(repo, "campaign-scoped-1", deptScope, undefined, {
            fieldKey: "college",
            value: "SRM",
        });
        expect(groups).toHaveLength(1);
        expect(groups[0]!.registrationCount).toBe(10);
        expect(groups[0]!.ambassadorIds).toEqual(["a1"]);
    });

    it("caches results per campaign+scope+filter — a second call skips the repo entirely", async () => {
        const repo = fakeRepo([fakeEnrollment("e1", "a1", { college: "SRM", department: "CSE" }, 10)]);
        await computeLeaderboardGroups(repo, "campaign-cache-1", deptScope);
        await computeLeaderboardGroups(repo, "campaign-cache-1", deptScope);
        expect(repo.listEnrollmentsForCampaign).toHaveBeenCalledTimes(1);
    });
});

describe("findLeaderboardScopeParentKey", () => {
    afterEach(() => jest.clearAllMocks());

    it("returns the parent field key for a field that depends on another", async () => {
        mockGetAmbassadorTypeByKey.mockResolvedValue({
            key: "STUDENT",
            label: "Student Ambassador",
            proofFieldLabel: "ID Card",
            applicationFields: [
                { key: "college", label: "College", type: "SELECT", required: true },
                { key: "department", label: "Department", type: "SELECT", required: true, dependsOnKey: "college" },
            ],
        });

        const parentKey = await findLeaderboardScopeParentKey("org1", ["STUDENT"], {
            kind: "APPLICATION_FIELD_GROUP",
            groupByFieldKeys: ["department"],
        });

        expect(parentKey).toBe("college");
    });

    it("returns null for an independent field", async () => {
        mockGetAmbassadorTypeByKey.mockResolvedValue({
            key: "STUDENT",
            label: "Student Ambassador",
            proofFieldLabel: "ID Card",
            applicationFields: [{ key: "college", label: "College", type: "SELECT", required: true }],
        });

        const parentKey = await findLeaderboardScopeParentKey("org1", ["STUDENT"], {
            kind: "APPLICATION_FIELD_GROUP",
            groupByFieldKeys: ["college"],
        });

        expect(parentKey).toBeNull();
    });

    it("skips the lookup entirely for individual-ambassador or multi-field scopes", async () => {
        expect(await findLeaderboardScopeParentKey("org1", ["STUDENT"], { kind: "INDIVIDUAL_AMBASSADOR" })).toBeNull();
        expect(
            await findLeaderboardScopeParentKey("org1", ["STUDENT"], {
                kind: "APPLICATION_FIELD_GROUP",
                groupByFieldKeys: ["college", "department"],
            }),
        ).toBeNull();
        expect(mockGetAmbassadorTypeByKey).not.toHaveBeenCalled();
    });
});
