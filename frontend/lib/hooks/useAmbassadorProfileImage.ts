'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ambassadorService } from '@/lib/services/ambassador-service';
import { compressImage } from '@/lib/utils/image-compress';

const MAX_UPLOAD_BYTES = 100 * 1024; // 100 KB cap

/** Compress-then-upload for the profile photo — compresses client-side to <= 100 KB
 *  before uploading to S3, preserving visual quality without hitting server-side limits.
 *  Circular display is a CSS concern (AmbassadorAvatar). */
export function useAmbassadorProfileImage() {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const uploadPhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setIsUploading(true);
    try {
      const compressed = await compressImage(file, { maxBytes: MAX_UPLOAD_BYTES });
      const { storageKey, url } = await ambassadorService.requestProfileImageUploadUrl({
        filename: compressed.name,
        mimeType: compressed.type,
      });
      await fetch(url, { method: 'PUT', body: compressed, headers: { 'Content-Type': compressed.type } });
      await ambassadorService.updateProfileImage({ profileImageStorageKey: storageKey, profileImageUrl: url.split('?')[0]! });
      await queryClient.invalidateQueries({ queryKey: ['ambassador-me'] });
      toast.success('Profile photo updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile photo');
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = async () => {
    setIsUploading(true);
    try {
      await ambassadorService.updateProfileImage({ profileImageStorageKey: null, profileImageUrl: null });
      await queryClient.invalidateQueries({ queryKey: ['ambassador-me'] });
      toast.success('Profile photo removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove profile photo');
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadPhoto, removePhoto, isUploading };
}
