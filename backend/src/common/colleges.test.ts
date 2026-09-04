import { getAllActiveColleges, getDepartmentsForCollege } from "./colleges";

jest.mock("../config/db", () => ({
    prisma: {
        platformCollege: {
            findMany: jest.fn(),
        },
        platformDepartment: {
            findMany: jest.fn(),
        },
    },
}));

import { prisma } from "../config/db";

const mockCollegeFindMany = prisma.platformCollege.findMany as jest.Mock;
const mockDepartmentFindMany = prisma.platformDepartment.findMany as jest.Mock;

describe("colleges catalog loading, caching, and fail-open behavior", () => {
    const mockColleges = [{ id: "c1", name: "XYZ University" }];
    const mockDepartments = [{ id: "d1", collegeId: "c1", name: "Computer Science" }];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("getAllActiveColleges loads and caches, skipping a second DB read", async () => {
        mockCollegeFindMany.mockResolvedValue(mockColleges);

        const result1 = await getAllActiveColleges();
        expect(result1).toEqual([{ id: "c1", name: "XYZ University" }]);
        expect(mockCollegeFindMany).toHaveBeenCalledTimes(1);

        const result2 = await getAllActiveColleges();
        expect(result2).toEqual(result1);
        expect(mockCollegeFindMany).toHaveBeenCalledTimes(1);
    });

    it("getDepartmentsForCollege filters by collegeId and caches per college", async () => {
        mockDepartmentFindMany.mockResolvedValue(mockDepartments);

        const result = await getDepartmentsForCollege("c1");
        expect(result).toEqual([{ id: "d1", collegeId: "c1", name: "Computer Science" }]);
        expect(mockDepartmentFindMany).toHaveBeenCalledWith({
            where: { collegeId: "c1", isActive: true },
            orderBy: { name: "asc" },
        });

        await getDepartmentsForCollege("c1");
        expect(mockDepartmentFindMany).toHaveBeenCalledTimes(1);
    });

    it("fails open to the last cached value when a later DB read errors", async () => {
        mockCollegeFindMany.mockResolvedValueOnce(mockColleges);
        const first = await getAllActiveColleges();
        expect(first).toHaveLength(1);

        // Force the cache to be considered expired, then simulate a DB outage.
        jest.spyOn(Date, "now").mockReturnValue(Date.now() + 10 * 60 * 1000);
        mockCollegeFindMany.mockRejectedValueOnce(new Error("connection refused"));

        const second = await getAllActiveColleges();
        expect(second).toEqual(first);

        jest.spyOn(Date, "now").mockRestore();
    });
});
