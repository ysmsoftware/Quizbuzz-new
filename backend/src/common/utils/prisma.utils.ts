/**
 * Shared utility functions for Prisma operations.
 */

/**
 * Removes properties with undefined values from an object.
 * Useful for ensuring Prisma queries don't inadvertently overwrite existing values with null,
 * and bypassing strict object validation checks in Prisma types.
 */
export function stripUndefined<T extends object>(obj: T): T {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined)
    ) as T;
}
