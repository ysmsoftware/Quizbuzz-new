'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { onImageError } from '@/lib/utils/image';

// Matches uploadViaPresignedUrl's MAX_UPLOAD_BYTES — shown to the user so a large image
// isn't a surprise once compression silently shrinks it.
const RECOMMENDED_SIZE_HINT = 'Square image recommended, e.g. 400×400px · auto-compressed to ~500KB';

/** Small thumbnail + upload/replace/clear control — compression and the presigned-upload
 *  request happen inside the `onUploadImage` callback the caller supplies (see
 *  useRewardImageUpload.ts / useContestPrizeImageUpload.ts); this component only manages
 *  the file picker and its own local "uploading" state, matching FileUpload.tsx's
 *  local-only-state pattern. Shared by RepeatingRowTable's `image` column type and the
 *  contest prize forms, which don't use RepeatingRowTable. Goodie/prize images render as
 *  small square-cropped (object-cover) thumbnails everywhere (GoodieThumb, prize cards) —
 *  a non-square source gets cropped to fit, which the size hint below calls out. */
export function ImageUploadCell({
  value,
  onChange,
  onUploadImage,
}: {
  value: string;
  onChange: (url: string) => void;
  onUploadImage: (file: File) => Promise<string>;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      onChange(await onUploadImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {value ? (
        <div className="relative h-8 w-8">
          <Image src={value} alt="" fill sizes="32px" onError={onImageError} className="rounded object-cover border border-border/50" />
          <button
            type="button"
            aria-label="Remove image"
            onClick={() => onChange('')}
            className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          aria-label="Add image"
          title={RECOMMENDED_SIZE_HINT}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
        </Button>
      )}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
