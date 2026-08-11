'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from '@/components/features/shared/FileUpload';
import { ambassadorCampaignApi } from '@/lib/api/ambassador-campaign.api';
import type { ShareTemplates } from '@/lib/types/ambassador';

export function ShareTemplatesEditor({
  value,
  onChange,
}: {
  value: ShareTemplates;
  onChange: (value: ShareTemplates) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handlePosterSelect = async (file: File, preview: string) => {
    setUploading(true);
    setUploadError('');
    try {
      const res = await ambassadorCampaignApi.uploadPoster({ fileData: preview, fileName: file.name });
      onChange({ ...value, posterImageUrl: res.data.url });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload poster');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Share Templates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>WhatsApp Message</Label>
          <Textarea
            rows={3}
            placeholder="Join using my link: {referralLink}"
            value={value.whatsappText ?? ''}
            onChange={(e) => onChange({ ...value, whatsappText: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">{'{referralLink}'} will be substituted automatically</p>
        </div>

        <div className="space-y-2">
          <Label>Instagram Caption</Label>
          <Textarea
            rows={3}
            placeholder="Join using my link: {referralLink}"
            value={value.instagramText ?? ''}
            onChange={(e) => onChange({ ...value, instagramText: e.target.value })}
          />
        </div>

        <FileUpload
          label={uploading ? 'Uploading…' : 'Poster Image'}
          preview={value.posterImageUrl}
          aspectRatio="video"
          onFileSelect={handlePosterSelect}
          onClear={() => {
            onChange({ ...value, posterImageUrl: undefined });
            setUploadError('');
          }}
        />
        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
      </CardContent>
    </Card>
  );
}
