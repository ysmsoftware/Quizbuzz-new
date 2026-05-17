import { useState, useCallback } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  label?: string;
  onFileSelect: (file: File, preview: string) => void;
  onClear?: () => void;
  preview?: string;
  accept?: string;
  maxSizeMB?: number;
  helperText?: string;
}

export function FileUpload({
  label,
  onFileSelect,
  onClear,
  preview,
  accept = 'image/*',
  maxSizeMB = 5,
  helperText,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);

      // Check file size
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        setError(`File size must be less than ${maxSizeMB}MB`);
        return;
      }

      // Check file type
      if (accept !== '*' && !file.type.match(accept.replace('*', '.*'))) {
        setError(`Invalid file type. Accepted: ${accept}`);
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = e.target?.result as string;
        onFileSelect(file, preview);
      };
      reader.readAsDataURL(file);
    },
    [onFileSelect, maxSizeMB, accept]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  return (
    <div className="space-y-3">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}

      {preview ? (
        <div className="space-y-2">
          <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            <button
              onClick={onClear}
              className="absolute top-2 right-2 p-1 bg-destructive/90 rounded hover:bg-destructive"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const input = document.querySelector(`input[type="file"]`) as HTMLInputElement;
              input?.click();
            }}
          >
            Change File
          </Button>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted hover:border-muted-foreground'
          }`}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground mb-1">
            Drag and drop your file here
          </p>
          <p className="text-xs text-muted-foreground mb-4">or click to select</p>
          <input
            type="file"
            accept={accept}
            onChange={handleInputChange}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const input = document.querySelector(`input[type="file"]`) as HTMLInputElement;
              input?.click();
            }}
          >
            Select File
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
