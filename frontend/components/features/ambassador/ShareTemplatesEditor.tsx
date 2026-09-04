'use client';

import { useState } from 'react';
import { ChevronDown, Eye, EyeOff, FileText, Paperclip, Plus, Trash2, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileUpload } from '@/components/features/shared/FileUpload';
import { ambassadorCampaignApi } from '@/lib/api/ambassador-campaign.api';
import { cn } from '@/lib/utils';
import type { ShareKit, ShareKitAsset, ShareTemplates } from '@/lib/types/ambassador';

const SHARE_TEMPLATE_PLACEHOLDERS: { token: string; description: string }[] = [
  { token: '{referralLink}', description: "ambassador's unique link" },
  { token: '{ambassadorName}', description: "ambassador's first name" },
  { token: '{contestName}', description: 'quiz title' },
];

const DEFAULT_TEMPLATE_TEXT =
  "*{contestName}* is live!\n\nI'm an ambassador for it — join using my link and I'll see you on the leaderboard!\n\n_Registration link:_\n{referralLink}\n\n— {ambassadorName}";

const SAMPLE_VALUES = {
  referralLink: 'https://quizbuzz.app/contests/sample-quiz/register?ref=ABC123',
  ambassadorName: 'Priya',
};

export function substitutePlaceholders(text: string, contestTitle?: string): string {
  const values = { ...SAMPLE_VALUES, contestName: contestTitle || 'Sample Quiz' };
  return Object.entries(values).reduce((acc, [key, val]) => acc.split(`{${key}}`).join(val), text);
}

function KitPreview({
  templateText,
  posterImageUrl,
  contestTitle,
}: {
  templateText: string;
  posterImageUrl?: string;
  contestTitle?: string;
}) {
  const sampleText = substitutePlaceholders(templateText, contestTitle);

  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 p-3.5 space-y-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sample Message Preview</p>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{sampleText.trim() || 'Write a message template above to preview.'}</p>
      {posterImageUrl && (
        <div className="pt-1">
          <img src={posterImageUrl} alt="Poster preview" className="w-full max-w-[200px] rounded-lg border border-border/50 shadow-sm" />
        </div>
      )}
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
  contestTitle?: string;
}) {
  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);
  const [uploadingKitId, setUploadingKitId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');

  // Hydrate kits from value.kits or legacy fields
  const kits: ShareKit[] = value.kits?.length
    ? value.kits
    : [
        {
          id: 'primary-kit',
          name: 'Primary Share Kit',
          description: 'Default promotion assets for ambassadors',
          templateText:
            value.whatsappText ||
            value.whatsappTemplates?.[0]?.text ||
            DEFAULT_TEMPLATE_TEXT,
          posterImageUrl: value.posterImageUrl,
          assets: [],
        },
      ];

  // Collapsible accordion state: default to all closed, or open first kit if only 1 kit exists
  const [openKitIds, setOpenKitIds] = useState<string[]>(() =>
    kits.length === 1 ? [kits[0].id] : []
  );

  const toggleKitOpen = (id: string) => {
    setOpenKitIds((prev) =>
      prev.includes(id) ? prev.filter((kId) => kId !== id) : [...prev, id]
    );
  };

  const updateKits = (nextKits: ShareKit[]) => {
    const primaryKit = nextKits[0];
    onChange({
      ...value,
      kits: nextKits,
      whatsappText: primaryKit?.templateText,
      whatsappTemplates: primaryKit
        ? [
            {
              id: primaryKit.id,
              label: primaryKit.name,
              text: primaryKit.templateText,
              includePoster: !!primaryKit.posterImageUrl,
            },
          ]
        : [],
      posterImageUrl: primaryKit?.posterImageUrl,
    });
  };

  const addKit = () => {
    const newKit: ShareKit = {
      id: crypto.randomUUID(),
      name: `Share Kit ${kits.length + 1}`,
      description: '',
      templateText: DEFAULT_TEMPLATE_TEXT,
      assets: [],
    };
    updateKits([...kits, newKit]);
    // Automatically open the new kit for editing
    setOpenKitIds((prev) => [...prev, newKit.id]);
  };

  const updateKit = (id: string, patch: Partial<ShareKit>) => {
    updateKits(kits.map((k) => (k.id === id ? { ...k, ...patch } : k)));
  };

  const removeKit = (id: string) => {
    updateKits(kits.filter((k) => k.id !== id));
    setOpenKitIds((prev) => prev.filter((kId) => kId !== id));
  };

  const uploadFileToStorage = async (file: File): Promise<string> => {
    const { data } = await ambassadorCampaignApi.getPosterUploadUrl({ filename: file.name, mimeType: file.type });
    const putRes = await fetch(data.url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    if (!putRes.ok) throw new Error('Upload to storage failed');
    return data.url.split('?')[0];
  };

  const handlePosterUpload = async (kitId: string, file: File) => {
    setUploadingKitId(kitId);
    setUploadError('');
    try {
      const permanentUrl = await uploadFileToStorage(file);
      updateKit(kitId, { posterImageUrl: permanentUrl });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload poster image');
    } finally {
      setUploadingKitId(null);
    }
  };

  const handleAddAssetFile = async (kitId: string, file: File) => {
    setUploadingKitId(kitId);
    setUploadError('');
    try {
      const permanentUrl = await uploadFileToStorage(file);
      const kit = kits.find((k) => k.id === kitId);
      const currentAssets = kit?.assets ?? [];
      const newAsset: ShareKitAsset = {
        id: crypto.randomUUID(),
        label: file.name,
        fileUrl: permanentUrl,
        mimeType: file.type,
      };
      updateKit(kitId, { assets: [...currentAssets, newAsset] });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload attachment file');
    } finally {
      setUploadingKitId(null);
    }
  };

  const removeAsset = (kitId: string, assetId: string) => {
    const kit = kits.find((k) => k.id === kitId);
    if (!kit) return;
    updateKit(kitId, { assets: (kit.assets ?? []).filter((a) => a.id !== assetId) });
  };

  const insertToken = (kitId: string, token: string) => {
    const kit = kits.find((k) => k.id === kitId);
    if (!kit) return;
    updateKit(kitId, { templateText: `${kit.templateText} ${token}` });
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base font-bold">Ambassador Kit &amp; Share Resources</CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
              Create share kits for your ambassadors with message templates, posters, and downloadable documents.
            </p>
          </div>
          <Button type="button" size="sm" onClick={addKit} className="h-8 text-xs font-semibold shrink-0">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Share Kit
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {kits.map((kit, kitIdx) => {
          const isOpen = openKitIds.includes(kit.id);
          const expandedPreview = expandedPreviewId === kit.id;

          return (
            <Card key={kit.id} className="border-border/60 bg-card overflow-hidden shadow-xs transition-all">
              {/* Header row (Collapsible toggle) */}
              <div
                onClick={() => toggleKitOpen(kit.id)}
                className="bg-muted/30 hover:bg-muted/50 px-4 py-3 border-b border-border/50 flex items-center justify-between gap-3 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <ChevronDown
                    className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0', isOpen && 'rotate-180')}
                  />

                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider shrink-0">
                      Kit #{kitIdx + 1}
                    </span>

                    <Input
                      value={kit.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateKit(kit.id, { name: e.target.value })}
                      placeholder="e.g. Launch Announcement"
                      className="h-8 text-sm font-semibold max-w-[200px] bg-background"
                    />

                    {!isOpen && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {kit.templateText && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1.5 font-normal">
                            Message Ready
                          </Badge>
                        )}
                        {kit.posterImageUrl && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1.5 font-normal">
                            Poster Image
                          </Badge>
                        )}
                        {kit.assets && kit.assets.length > 0 && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1.5 font-normal">
                            <Paperclip className="h-2.5 w-2.5 mr-0.5" />
                            {kit.assets.length} {kit.assets.length === 1 ? 'file' : 'files'}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setExpandedPreviewId(expandedPreview ? null : kit.id)}
                  >
                    {expandedPreview ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                    {expandedPreview ? 'Hide' : 'Preview'}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-medium"
                    onClick={() => toggleKitOpen(kit.id)}
                  >
                    {isOpen ? 'Collapse' : 'Edit'}
                  </Button>

                  {kits.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeKit(kit.id)}
                      aria-label="Remove kit"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Expanded Kit Content */}
              {isOpen && (
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Description / Notes (Optional)</Label>
                    <Input
                      value={kit.description ?? ''}
                      onChange={(e) => updateKit(kit.id, { description: e.target.value })}
                      placeholder="e.g. Share this during the first 3 days of campaign launch"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Message Template</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {SHARE_TEMPLATE_PLACEHOLDERS.map((p) => (
                          <button
                            key={p.token}
                            type="button"
                            onClick={() => insertToken(kit.id, p.token)}
                            className="text-[10px] bg-muted hover:bg-muted/80 text-foreground font-mono px-1.5 py-0.5 rounded border border-border/50 transition-colors"
                            title={p.description}
                          >
                            + {p.token}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Textarea
                      rows={4}
                      value={kit.templateText}
                      onChange={(e) => updateKit(kit.id, { templateText: e.target.value })}
                      placeholder="Type template message with placeholders..."
                      className="text-xs leading-relaxed"
                    />
                  </div>

                  {expandedPreview && (
                    <KitPreview
                      templateText={kit.templateText}
                      posterImageUrl={kit.posterImageUrl}
                      contestTitle={contestTitle}
                    />
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/40">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Primary Poster / Banner Image</Label>
                      <FileUpload
                        label={uploadingKitId === kit.id ? 'Uploading…' : 'Poster Image'}
                        preview={kit.posterImageUrl}
                        aspectRatio="video"
                        helperText="Shared along with the kit message."
                        onFileSelect={(file) => handlePosterUpload(kit.id, file)}
                        onClear={() => updateKit(kit.id, { posterImageUrl: undefined })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Attached Files &amp; Assets</Label>
                      <p className="text-[11px] text-muted-foreground">Add extra PDFs, graphics, or document assets for ambassadors.</p>
                      
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {(kit.assets ?? []).map((asset) => (
                          <div key={asset.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/40 border border-border/50 text-xs">
                            <div className="flex items-center gap-2 min-w-0 truncate">
                              <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate font-medium">{asset.label}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive shrink-0"
                              onClick={() => removeAsset(kit.id, asset.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-dashed"
                          disabled={uploadingKitId === kit.id}
                          asChild
                        >
                          <span>
                            <Upload className="h-3.5 w-3.5 mr-1" />
                            {uploadingKitId === kit.id ? 'Uploading...' : 'Attach File (PDF, Image)'}
                          </span>
                        </Button>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleAddAssetFile(kit.id, file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

        <Button type="button" variant="outline" size="sm" onClick={addKit} className="w-full border-dashed">
          <Plus className="h-4 w-4 mr-2" />
          Add Share Kit
        </Button>
      </CardContent>
    </Card>
  );
}

