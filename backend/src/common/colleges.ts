import { prisma } from "../config/db";

/**
 * Read SDK for quizbuzz-ops-next's College/Department catalog, mirrored into
 * this app's own database via a write-through on every create/edit (same
 * mechanism as platform_ambassador_types — see src/common/ambassador-types.ts).
 * This module only ever reads — ops-next is the single source of truth.
 */

export interface CollegeOption {
    id: string;
    name: string;
}

export interface DepartmentOption {
    id: string;
    collegeId: string;
    name: string;
}

const CACHE_TTL_MS = 60_000;
let collegesCache: { value: CollegeOption[]; expires: number } | null = null;
const departmentsCache = new Map<string, { value: DepartmentOption[]; expires: number }>();

export async function getAllActiveColleges(): Promise<CollegeOption[]> {
    if (collegesCache && collegesCache.expires > Date.now()) return collegesCache.value;

    try {
        const rows = await prisma.platformCollege.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
        });
        const value: CollegeOption[] = rows.map((row) => ({ id: row.id, name: row.name }));
        collegesCache = { value, expires: Date.now() + CACHE_TTL_MS };
        return value;
    } catch (err) {
        console.error("getAllActiveColleges() DB read failed:", err);
        return collegesCache?.value ?? [];
    }
}

export async function getDepartmentsForCollege(collegeId: string): Promise<DepartmentOption[]> {
    const cached = departmentsCache.get(collegeId);
    if (cached && cached.expires > Date.now()) return cached.value;

    try {
        const rows = await prisma.platformDepartment.findMany({
            where: { collegeId, isActive: true },
            orderBy: { name: "asc" },
        });
        const value: DepartmentOption[] = rows.map((row) => ({ id: row.id, collegeId: row.collegeId, name: row.name }));
        departmentsCache.set(collegeId, { value, expires: Date.now() + CACHE_TTL_MS });
        return value;
    } catch (err) {
        console.error(`getDepartmentsForCollege('${collegeId}') DB read failed:`, err);
        // Fail closed: a college whose departments can't be read simply has none available.
        return cached?.value ?? [];
    }
}
