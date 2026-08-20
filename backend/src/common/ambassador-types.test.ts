import {
    getAllActiveAmbassadorTypes,
    getActiveAmbassadorTypeByKey,
    getEnabledAmbassadorTypes,
} from "./ambassador-types";

// Mock the global prisma instance
jest.mock("../config/db", () => ({
    prisma: {
        platformAmbassadorType: {
            findMany: jest.fn(),
        },
        organizationAmbassadorTypeAccess: {
            findMany: jest.fn(),
        },
    },
}));

import { prisma } from "../config/db";

const mockPlatformAmbassadorTypeFindMany = prisma.platformAmbassadorType.findMany as jest.Mock;
const mockOrganizationAmbassadorTypeAccessFindMany = prisma.organizationAmbassadorTypeAccess.findMany as jest.Mock;

describe("ambassador-types catalog loading and caching", () => {
    const mockTypes = [
        {
            key: "CAMPUS_AMBASSADOR",
            label: "Campus Ambassador",
            proofFieldLabel: "ID Card",
            applicationFields: [
                { key: "college", label: "College", type: "TEXT", required: true },
            ],
            isActive: true,
        },
        {
            key: "FACULTY_AMBASSADOR",
            label: "Faculty Ambassador",
            proofFieldLabel: "Employee ID",
            applicationFields: [
                { key: "department", label: "Dept", type: "TEXT", required: true },
            ],
            isActive: true,
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        // Clear caches by accessing the internal maps/variables if needed, or rely on distinct test runs
    });

    it("getAllActiveAmbassadorTypes loads types and caches them", async () => {
        mockPlatformAmbassadorTypeFindMany.mockResolvedValue(mockTypes);

        // First call - should hit the DB
        const result1 = await getAllActiveAmbassadorTypes();
        expect(result1).toHaveLength(2);
        expect(result1[0]!.key).toBe("CAMPUS_AMBASSADOR");
        expect(mockPlatformAmbassadorTypeFindMany).toHaveBeenCalledTimes(1);

        // Second call - should return cached value without hitting the DB again
        const result2 = await getAllActiveAmbassadorTypes();
        expect(result2).toEqual(result1);
        expect(mockPlatformAmbassadorTypeFindMany).toHaveBeenCalledTimes(1);
    });

    it("getActiveAmbassadorTypeByKey returns correct type or null", async () => {
        mockPlatformAmbassadorTypeFindMany.mockResolvedValue(mockTypes);

        const type = await getActiveAmbassadorTypeByKey("CAMPUS_AMBASSADOR");
        expect(type).not.toBeNull();
        expect(type!.label).toBe("Campus Ambassador");

        const missing = await getActiveAmbassadorTypeByKey("NON_EXISTENT");
        expect(missing).toBeNull();
    });

    it("getEnabledAmbassadorTypes filters types by organization access mapping", async () => {
        const orgId = "org-123";
        // Mock only CAMPUS_AMBASSADOR being enabled for org-123
        mockOrganizationAmbassadorTypeAccessFindMany.mockResolvedValue([
            { typeKey: "CAMPUS_AMBASSADOR" },
        ]);
        mockPlatformAmbassadorTypeFindMany.mockResolvedValue([mockTypes[0]!]);

        const enabled = await getEnabledAmbassadorTypes(orgId);
        expect(enabled).toHaveLength(1);
        expect(enabled[0]!.key).toBe("CAMPUS_AMBASSADOR");

        // Verify it queried both tables
        expect(mockOrganizationAmbassadorTypeAccessFindMany).toHaveBeenCalledWith({
            where: { organizationId: orgId, isEnabled: true },
            select: { typeKey: true },
        });
        expect(mockPlatformAmbassadorTypeFindMany).toHaveBeenCalledWith({
            where: { key: { in: ["CAMPUS_AMBASSADOR"] }, isActive: true },
        });
    });
});
