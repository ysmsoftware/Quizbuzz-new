'use client';

import { useState } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FileUpload } from '@/components/features/shared/FileUpload';
import { ambassadorCampaignApi } from '@/lib/api/ambassador-campaign.api';
import type { ShareMessageTemplate, ShareTemplates } from '@/lib/types/ambassador';

/** Tokens an admin can drop into a message template — substituted per-ambassador when the
 *  message is actually shared (referralLink is unique per ambassador; ambassadorName/
 *  contestName are filled in from that ambassador's enrollment). Documented inline so the
 *  admin doesn't have to guess the exact spelling/braces. */
const SHARE_TEMPLATE_PLACEHOLDERS: { token: string; description: string }[] = [
  { token: '{referralLink}', description: "the ambassador's unique registration link" },
  { token: '{ambassadorName}', description: "the ambassador's first name" },
  { token: '{contestName}', description: 'the quiz being promoted' },
];

const DEFAULT_TEMPLATE_TEXT =
  "Hey! I'm an ambassador for {contestName} — join using my link and I'll see you on the leaderboard!\n\n{referralLink}\n\n— {ambassadorName}";

const SAMPLE_VALUES = {
  referralLink: 'https://quizbuzz.app/contests/sample-quiz/register?ref=ABC123',
  ambassadorName: 'Priya',
};

function substitutePlaceholders(text: string, contestTitle?: string): string {
  const values = { ...SAMPLE_VALUES, contestName: contestTitle || 'Sample Quiz' };
  return Object.entries(values).reduce((acc, [key, val]) => acc.split(`{${key}}`).join(val), text);
}

function TemplatePreview({
  template,
  posterImageUrl,
  contestTitle,
}: {
  template: ShareMessageTemplate;
  posterImageUrl?: string;
  contestTitle?: string;
}) {
  const sampleText = substitutePlaceholders(template.text, contestTitle);
  const showPoster = template.includePoster && !!posterImageUrl;

  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sample message</p>
      <p className="text-sm whitespace-pre-wrap">{sampleText.trim() || 'Nothing to preview yet — write a message above.'}</p>
      {template.includePoster &&
        (showPoster ? (
          <img src={posterImageUrl} alt="Poster preview" className="w-full max-w-[160px] rounded-md border border-border/50" />
        ) : (
          <p className="text-xs text-muted-foreground italic">No poster uploaded yet — shown as text-only until one is.</p>
        ))}
    </div>
  );
}

export function ShareTemplatesEditor({
  value,
  onChange,
  contestTitle,
}: {
  value: ShareTemplates;
  onChange: (value: ShareTemplates) => void;
  /** For the sample-message preview only — the actual name is substituted per-ambassador at
   *  share time. Undefined outside the wizard (e.g. the post-publish Kit tab), where the
   *  preview just falls back to "Sample Quiz". */
  contestTitle?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [localPosterPreview, setLocalPosterPreview] = useState<string | null>(null);
  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);

  // Auto-migrates a campaign saved before multi-template support existed (whatsappText set,
  // whatsappTemplates missing) into a single-item list, so nothing already saved disappears.
  const templates: ShareMessageTemplate[] =
    value.whatsappTemplates ?? (value.whatsappText ? [{ id: 'legacy', label: 'Default', text: value.whatsappText, includePoster: true }] : []);

  // whatsappText always mirrors the primary (first) template — that's the single field the
  // already-built ambassador dashboard (ShareCampaignCard, KitTab summary) reads, so keeping
  // it in sync means the multi-template picker here doesn't require any dashboard changes.
  const setTemplates = (next: ShareMessageTemplate[]) => {
    onChange({ ...value, whatsappTemplates: next, whatsappText: next[0]?.text });
  };

  const addTemplate = () => {
    const next: ShareMessageTemplate = {
      id: crypto.randomUUID(),
      label: templates.length === 0 ? 'Default' : `Message ${templates.length + 1}`,
      text: templates.length === 0 ? DEFAULT_TEMPLATE_TEXT : '',
      includePoster: true,
    };
    setTemplates([...templates, next]);
    setExpandedPreviewId(next.id);
  };

  const updateTemplate = (id: string, patch: Partial<ShareMessageTemplate>) =>
    setTemplates(templates.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const removeTemplate = (id: string) => setTemplates(templates.filter((t) => t.id !== id));

  const handlePosterSelect = async (file: File, preview: string) => {
    setLocalPosterPreview(preview);
    setUploading(true);
    setUploadError('');
    try {
      const { data } = await ambassadorCampaignApi.getPosterUploadUrl({ filename: file.name, mimeType: file.type });
      const putRes = await fetch(data.url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!putRes.ok) throw new Error('Upload to storage failed');
      // Presigned PUT URLs carry a signature query string that's only valid for the PUT
      // itself — the permanent object URL is everything before the "?" (same pattern as
      // app/ambassador/[orgSlug]/apply/page.tsx's proof-upload flow).
      onChange({ ...value, posterImageUrl: data.url.split('?')[0] });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload poster');
      setLocalPosterPreview(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Share Templates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>WhatsApp Message Templates</Label>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {SHARE_TEMPLATE_PLACEHOLDERS.map((p) => (
              <span key={p.token} className="text-xs text-muted-foreground">
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">{p.token}</code> — {p.description}
              </span>
            ))}
          </div>

          <div className="space-y-3">
            {templates.map((t) => {
              const expanded = expandedPreviewId === t.id;
              return (
                <Card key={t.id} className="border-border/50 bg-background">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={t.label}
                        onChange={(e) => updateTemplate(t.id, { label: e.target.value })}
                        placeholder="Template name"
                        className="h-8 max-w-[220px] font-medium"
                      />
                      <div className="flex-1" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedPreviewId(expanded ? null : t.id)}
                      >
                        {expanded ? <EyeOff className="h-4 w-4 mr-1.5" /> : <Eye className="h-4 w-4 mr-1.5" />}
                        {expanded ? 'Hide preview' : 'Preview'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeTemplate(t.id)}
                        aria-label="Remove template"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <Textarea
                      rows={3}
                      placeholder="Join using my link: {referralLink}"
                      value={t.text}
                      onChange={(e) => updateTemplate(t.id, { text: e.target.value })}
                    />
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={t.includePoster}
                        onCheckedChange={(checked) => updateTemplate(t.id, { includePoster: checked })}
                      />
                      <Label className="text-sm font-normal text-muted-foreground">Attach the poster image with this message</Label>
                    </div>
                    {expanded && <TemplatePreview template={t} posterImageUrl={value.posterImageUrl} contestTitle={contestTitle} />}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addTemplate}>
            <Plus className="h-4 w-4 mr-2" />
            Add message template
          </Button>
        </div>

        <div className="space-y-2 pt-2 border-t border-border/50">
          <Label>Instagram Caption</Label>
          <Textarea
            rows={3}
            placeholder="Join using my link: {referralLink}"
            value={value.instagramText ?? ''}
            onChange={(e) => onChange({ ...value, instagramText: e.target.value })}
          />
        </div>

        <div className="pt-2 border-t border-border/50">
          <FileUpload
            label={uploading ? 'Uploading…' : 'Poster Image'}
            preview={localPosterPreview ?? value.posterImageUrl}
            aspectRatio="video"
            helperText="Shared alongside any message template with “Attach the poster image” switched on."
            onFileSelect={handlePosterSelect}
            onClear={() => {
              onChange({ ...value, posterImageUrl: undefined });
              setLocalPosterPreview(null);
              setUploadError('');
            }}
          />
          {uploadError && <p className="text-sm text-destructive mt-2">{uploadError}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
