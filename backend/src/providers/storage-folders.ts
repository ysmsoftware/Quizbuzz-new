/**
 * Single source of truth for presigned-upload folder prefixes.
 *
 * Every direct-to-storage presigned PUT (S3 or local) writes to
 * `{prefix}/{id}/{uuid}/{filename}`, and both StorageProviders — plus the
 * local-dev PUT relay in quiz-proctoring.controller.ts — must agree on which
 * prefixes are allowed or a folder valid in one environment 403s in another
 * (this list existed separately in s3.provider.ts and local.provider.ts and
 * had already drifted once: "ambassador-profile" was added to one but not
 * the other, breaking local-mode profile-photo uploads).
 *
 * Adding a new presigned-upload folder anywhere in the app means adding its
 * prefix here — nowhere else.
 */
export const PRESIGNED_UPLOAD_FOLDER_PREFIXES = [
    "proctoring",
    "ambassador-proof",
    "ambassador-profile",
    "ambassador-campaign-poster",
    "ambassador-campaign-reward-image",
    "ambassador-campaign-kit-asset",
    "contest-prize-reward-image",
] as const;

/** Validates a `folder` param (e.g. "ambassador-proof/org123/uuid") before it's used
 *  to build a presigned PUT URL. Throws on anything not matching prefix/id/id. */
export function validatePresignedFolder(folder: string): void {
    const parts = folder.split("/");
    if (parts.length !== 3 || !PRESIGNED_UPLOAD_FOLDER_PREFIXES.includes(parts[0] as any) || !parts[1] || !parts[2]) {
        throw new Error("Access Denied: Invalid folder structure.");
    }
}

/** Validates a full storage `key` (folder + filename, e.g. what local-upload receives
 *  as its `?key=` query param) before writing to disk. */
export function validatePresignedKey(key: string): boolean {
    const parts = key.split("/");
    return parts.length === 4 && PRESIGNED_UPLOAD_FOLDER_PREFIXES.includes(parts[0] as any) && !!parts[1] && !!parts[2] && !!parts[3];
}
