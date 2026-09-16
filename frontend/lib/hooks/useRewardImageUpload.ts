'use client';

import { ambassadorCampaignApi } from '@/lib/api/ambassador-campaign.api';
import { uploadViaPresignedUrl } from '@/lib/utils/upload-via-presigned-url';

/** Compress-then-upload for a reward goodie image (milestone tier / speed bonus tier /
 *  leaderboard rank) — same presigned-PUT flow as the campaign poster upload
 *  (ShareTemplatesEditor.tsx), just a different storage folder (`assetType: 'reward-image'`). */
export function useRewardImageUpload() {
  return (file: File) =>
    uploadViaPresignedUrl(file, (args) => ambassadorCampaignApi.getPosterUploadUrl({ ...args, assetType: 'reward-image' }));
}
