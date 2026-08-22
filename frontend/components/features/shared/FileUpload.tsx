import { useState, useCallback, useRef } from 'react';
import { Upload, X, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AspectRatio = 'square' | 'video' | 'banner' | 'card' | 'auto';

interface FileUploadProps {
  label?: string;
  onFileSelect: (file: File, preview: string) => void;
  onClear?: () => void;
  preview?: string | null;
  accept?: string;
  maxSizeMB?: number;
  helperText?: string;
  /** Controls the preview container aspect ratio. Defaults to 'square'. */
  aspectRatio?: AspectRatio;
}

const ASPECT_RATIO_CLASSES: Record<AspectRatio, string> = {
  square: 'aspect-square',
  video: 'aspect-video',
  banner: 'aspect-[3/1]',
  card: 'aspect-[1.586/1]', // ID-1 card ratio (85.6mm x 53.98mm) — driver's license / student ID shape
  auto: '',
};

/** Sub-1MB caps (e.g. 0.5 for 500KB) read as "0.5MB" otherwise — show KB instead. */
function formatMaxSize(maxSizeMB: number): string {
  return maxSizeMB < 1 ? `${Math.round(maxSizeMB * 1024)}KB` : `${maxSizeMB}MB`;
}

export function FileUpload({
  label,
  onFileSelect,
  onClear,
  preview,
  accept = 'image/*',
  maxSizeMB = 5,
  helperText,
  aspectRatio = 'square',
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const triggerFilePicker = () => inputRef.current?.click();

  const handleFile = useCallback(
    (file: File) => {
      setError(null);

      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        setError(`File size must be less than ${formatMaxSize(maxSizeMB)}`);
        return;
      }

      // `accept` can be a comma-separated list of exact MIME types and/or wildcards
      // (e.g. "image/*,application/pdf") — matching it as a single regex (the old
      // approach) silently rejected every file, since a comma-joined pattern like
      // "image/.*,application/pdf" never appears verbatim inside a real MIME type.
      const isAccepted =
        accept === '*' ||
        accept.split(',').some((rawPattern) => {
          const pattern = rawPattern.trim();
          if (pattern.endsWith('/*')) return file.type.startsWith(pattern.slice(0, -1));
          return file.type === pattern;
        });

      if (!isAccepted) {
        setError(`Invalid file type. Accepted: ${accept}`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        onFileSelect(file, dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [onFileSelect, maxSizeMB, accept]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be re-selected after clearing
    e.currentTarget.value = '';
  };

  const aspectClass = ASPECT_RATIO_CLASSES[aspectRatio];

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}

      {/* Hidden file input — controlled via ref */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />

      {preview ? (
        /* ── Preview state ── */
        <div className="space-y-2">
          <div
            className={cn(
              'relative w-full bg-muted rounded-xl overflow-hidden',
              aspectClass
            )}
          >
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            {/* Clear button */}
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                className="absolute top-2 right-2 p-1.5 bg-destructive/90 rounded-lg hover:bg-destructive transition-colors shadow"
                aria-label="Remove image"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            )}
            {/* Change overlay */}
            <button
              type="button"
              onClick={triggerFilePicker}
              className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100"
              aria-label="Change image"
            >
              <span className="text-white text-xs font-bold bg-black/60 px-3 py-1.5 rounded-full">
                Change Image
              </span>
            </button>
          </div>
        </div>
      ) : (
        /* ── Drop zone state ── */
        <div
          role="button"
          tabIndex={0}
          onClick={triggerFilePicker}
          onKeyDown={(e) => e.key === 'Enter' && triggerFilePicker()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'w-full border-2 border-dashed rounded-xl text-center transition-all cursor-pointer select-none',
            'flex flex-col items-center justify-center gap-2 p-8',
            aspectClass,
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/60 hover:bg-primary/5'
          )}
        >
          <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground mb-0.5">
              Drag & drop your image here
            </p>
            <p className="text-xs text-muted-foreground">
              or <span className="text-primary font-medium underline underline-offset-2">click to browse</span>
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            Max {formatMaxSize(maxSizeMB)} · {accept}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-destructive font-medium">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
