'use client';

import { getPrizeRewardImageUploadUrl } from '@/lib/api/contests.api';
import { uploadViaPresignedUrl } from '@/lib/utils/upload-via-presigned-url';

/** Compress-then-upload for a contest prize's goodie image — same presigned-PUT flow as
 *  useRewardImageUpload.ts (ambassador campaign rewards), just a different endpoint/folder. */
export function useContestPrizeImageUpload() {
  return (file: File) => uploadViaPresignedUrl(file, getPrizeRewardImageUploadUrl);
}
