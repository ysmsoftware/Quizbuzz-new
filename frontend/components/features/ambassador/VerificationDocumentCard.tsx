'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/features/shared/FileUpload';
import { ambassadorService } from '@/lib/services/ambassador-service';

interface VerificationDocumentCardProps {
  proofUrl: string;
  /** Per-type label for what this document actually is (e.g. "College ID card" vs.
   *  "Employee ID card") — set by whichever ambassador type this person signed up as. */
  proofFieldLabel: string;
}

function isPdf(url: string) {
  return url.split('?')[0]!.toLowerCase().endsWith('.pdf');
}

/** Shows the ID proof that's already on file — a real preview, not just a "replace it"
 *  prompt — with Replace revealing the upload dropzone only when actually needed. */
export function VerificationDocumentCard({ proofUrl, proofFieldLabel }: VerificationDocumentCardProps) {
  const queryClient = useQueryClient();
  const [isReplacing, setIsReplacing] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newPreview, setNewPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadReplacement = async () => {
    if (!newFile) return;
    setIsUploading(true);
    try {
      const { storageKey, url } = await ambassadorService.requestAuthenticatedUploadUrl({
        filename: newFile.name,
        mimeType: newFile.type,
      });
      await fetch(url, { method: 'PUT', body: newFile, headers: { 'Content-Type': newFile.type } });
      await ambassadorService.updateProof({ proofStorageKey: storageKey, proofUrl: url.split('?')[0]! });
      queryClient.invalidateQueries({ queryKey: ['ambassador-me'] });
      setNewFile(null);
      setNewPreview(null);
      setIsReplacing(false);
      toast.success(`${proofFieldLabel} updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to replace document');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="border-border/50">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Verification</p>
            <h2 className="text-base font-bold text-foreground mt-0.5">{proofFieldLabel}</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 bg-success/10 text-success shrink-0">
            On file
          </span>
        </div>

        <div className="flex gap-4 items-start flex-wrap sm:flex-nowrap">
          {/* Landscape, ID-card-shaped preview — not a portrait thumbnail — since proof
              documents are almost always a photographed or scanned ID card. */}
          <div className="w-[180px] shrink-0">
            {isPdf(proofUrl) ? (
              <a
                href={proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex aspect-[1.586/1] w-full items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground hover:border-primary/50 transition-colors"
              >
                <FileText className="h-8 w-8" />
              </a>
            ) : (
              <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={proofUrl}
                  alt={proofFieldLabel}
                  className="aspect-[1.586/1] w-full rounded-xl border border-border object-cover hover:opacity-90 transition-opacity"
                />
              </a>
            )}
          </div>

          <div className="flex-1 min-w-[180px]">
            <p className="text-xs text-muted-foreground mb-3">This is what your campaigns' organizers see when reviewing your application.</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" asChild>
                <a href={proofUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  View full size
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsReplacing((v) => !v)}>
                <RefreshCw className="h-3.5 w-3.5" />
                Replace
              </Button>
            </div>
          </div>
        </div>

        {isReplacing && (
          <div className="mt-4 pt-4 border-t border-border/60 space-y-3">
            <FileUpload
              accept="image/*,application/pdf"
              aspectRatio="card"
              preview={newPreview}
              onFileSelect={(file, preview) => {
                setNewFile(file);
                setNewPreview(preview);
              }}
              onClear={() => {
                setNewFile(null);
                setNewPreview(null);
              }}
            />
            {newFile && (
              <Button size="sm" onClick={uploadReplacement} disabled={isUploading}>
                {isUploading ? 'Uploading…' : 'Upload replacement'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
