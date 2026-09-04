'use client';

import { useState } from 'react';
import {
  ChevronRight,
  Download,
  Eye,
  FileText,
  Gift,
  MessageCircle,
  Paperclip,
  Share2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CopyIconButton } from './CopyIconButton';
import { fillShareTemplate, type ShareTemplateValues } from '@/lib/utils/share-template';
import { shareToWhatsApp } from '@/lib/utils/whatsapp-share';
import type { ShareKit, ShareTemplates } from '@/lib/types/ambassador';

interface AmbassadorKitCardProps {
  shareTemplates: ShareTemplates;
  values: ShareTemplateValues;
  campaignName?: string;
}

export function AmbassadorKitCard({ shareTemplates, values, campaignName }: AmbassadorKitCardProps) {
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [selectedKit, setSelectedKit] = useState<ShareKit | null>(null);

  // Normalize share kits
  const kits: ShareKit[] = shareTemplates.kits?.length
    ? shareTemplates.kits
    : [
        {
          id: 'primary',
          name: 'Primary Share Kit',
          description: 'Share templates for promoting this campaign',
          templateText:
            shareTemplates.whatsappText ||
            shareTemplates.whatsappTemplates?.[0]?.text ||
            '',
          posterImageUrl: shareTemplates.posterImageUrl,
          assets: [],
        },
      ].filter((k) => k.templateText || k.posterImageUrl);

  const handleShareWhatsApp = async (kitId: string, text: string, posterImageUrl?: string) => {
    setSendingId(kitId);
    try {
      const result = await shareToWhatsApp({
        text,
        posterImageUrl,
        title: campaignName,
      });
      if (result === 'shared') {
        toast.success('Shared successfully');
      } else if (result === 'clipboard') {
        toast.success('Poster copied to clipboard');
      } else if (result === 'text-only' && posterImageUrl) {
        toast.info('WhatsApp opened with text. Attach poster manually if needed.');
      }
    } finally {
      setSendingId(null);
    }
  };

  const handleNativeShare = async (title: string, text: string, url?: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: url || values.referralLink });
        toast.success('Shared!');
      } catch {
        // User cancelled or share failed
      }
    } else {
      await navigator.clipboard.writeText(`${text}\n\n${url || values.referralLink}`);
      toast.success('Message and link copied to clipboard');
    }
  };

  if (kits.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8">
          <Empty>
            <EmptyMedia variant="icon">
              <Gift className="h-5 w-5" />
            </EmptyMedia>
            <EmptyTitle className="text-sm">No kit assets yet</EmptyTitle>
            <EmptyDescription className="text-xs">
              The organizer hasn&apos;t added share templates for this campaign.
            </EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Ambassador Kits &amp; Resources
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ready-to-use promotional kits. Select any kit to preview, share, or download assets.
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-semibold">
              {kits.length} {kits.length === 1 ? 'Kit Available' : 'Kits Available'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {kits.map((kit) => {
            const filledText = kit.templateText ? fillShareTemplate(kit.templateText, values) : '';
            return (
              <div
                key={kit.id}
                onClick={() => setSelectedKit(kit)}
                className="group relative rounded-xl border border-border/60 hover:border-primary/40 bg-card hover:bg-muted/40 p-4 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                {/* Left section: Poster thumbnail / Icon & Title */}
                <div className="flex items-center gap-3.5 min-w-0">
                  {kit.posterImageUrl ? (
                    <img
                      src={kit.posterImageUrl}
                      alt={kit.name}
                      className="w-14 h-14 rounded-lg border border-border/50 object-cover shrink-0 bg-muted group-hover:scale-105 transition-transform duration-200 shadow-2xs"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary group-hover:bg-primary/20 transition-colors">
                      <Sparkles className="h-5 w-5" />
                    </div>
                  )}

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                        {kit.name}
                      </h4>
                      {kit.templateText && (
                        <Badge variant="secondary" className="text-[10px] font-medium py-0 px-1.5 bg-primary/10 text-primary border-primary/20">
                          Message Ready
                        </Badge>
                      )}
                    </div>
                    {kit.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                        {kit.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-0.5 text-[11px] text-muted-foreground flex-wrap">
                      {kit.posterImageUrl && (
                        <span className="flex items-center gap-1 font-medium">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          Poster graphic included
                        </span>
                      )}
                      {kit.assets && kit.assets.length > 0 && (
                        <span className="flex items-center gap-1 font-medium">
                          <Paperclip className="h-3 w-3 text-muted-foreground" />
                          {kit.assets.length} {kit.assets.length === 1 ? 'file attached' : 'files attached'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right section: Quick actions & View Kit button */}
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                  {filledText && (
                    <>
                      <Button
                        size="sm"
                        className="bg-[#25D366] text-white hover:bg-[#20bd5a] h-8 text-xs font-semibold shadow-xs"
                        disabled={sendingId === kit.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareWhatsApp(kit.id, filledText, kit.posterImageUrl);
                        }}
                      >
                        <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                        {sendingId === kit.id ? 'Preparing…' : 'WhatsApp'}
                      </Button>

                      <div onClick={(e) => e.stopPropagation()}>
                        <CopyIconButton text={filledText} label="Message copied" />
                      </div>
                    </>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-medium group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedKit(kit);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    View Kit
                    <ChevronRight className="h-3.5 w-3.5 ml-0.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Kit Detail Modal */}
      <AmbassadorKitDetailModal
        kit={selectedKit}
        open={!!selectedKit}
        onOpenChange={(open) => {
          if (!open) setSelectedKit(null);
        }}
        values={values}
        campaignName={campaignName}
        sendingId={sendingId}
        onShareWhatsApp={handleShareWhatsApp}
        onNativeShare={handleNativeShare}
      />
    </>
  );
}

function AmbassadorKitDetailModal({
  kit,
  open,
  onOpenChange,
  values,
  campaignName,
  sendingId,
  onShareWhatsApp,
  onNativeShare,
}: {
  kit: ShareKit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: ShareTemplateValues;
  campaignName?: string;
  sendingId: string | null;
  onShareWhatsApp: (kitId: string, text: string, posterImageUrl?: string) => void;
  onNativeShare: (title: string, text: string, url?: string) => void;
}) {
  if (!kit) return null;

  const filledText = kit.templateText ? fillShareTemplate(kit.templateText, values) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden border-border/60">
        <DialogHeader className="p-6 pb-4 border-b border-border/40">
          <div className="flex items-center justify-between gap-3 pr-6">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Sparkles className="h-5 w-5 text-primary" />
                {kit.name}
              </DialogTitle>
              {kit.description && (
                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  {kit.description}
                </DialogDescription>
              )}
            </div>
            <Badge variant="outline" className="shrink-0 text-xs font-semibold">
              Share Kit
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Share Message Section */}
          {filledText ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Ready-to-Send Share Message
                </h4>
                <CopyIconButton text={filledText} label="Message copied" />
              </div>

              <div className="bg-muted/40 border border-border/50 rounded-xl p-4 text-xs space-y-3">
                <p className="whitespace-pre-line leading-relaxed text-foreground font-sans">
                  {filledText}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                  <Button
                    size="sm"
                    className="bg-[#25D366] text-white hover:bg-[#20bd5a] h-8 text-xs font-semibold"
                    disabled={sendingId === kit.id}
                    onClick={() => onShareWhatsApp(kit.id, filledText, kit.posterImageUrl)}
                  >
                    <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                    {sendingId === kit.id ? 'Preparing…' : 'Share via WhatsApp'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => onNativeShare(campaignName || kit.name, filledText)}
                  >
                    <Share2 className="h-3.5 w-3.5 mr-1.5" />
                    Share / Copy Link
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-muted/30 border border-border/40 rounded-xl p-4 text-xs text-muted-foreground text-center">
              No message template defined for this kit.
            </div>
          )}

          {/* Campaign Poster Section */}
          {kit.posterImageUrl && (
            <div className="space-y-3 pt-2 border-t border-border/40">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Campaign Poster &amp; Graphic
              </h4>
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-card border border-border/50 rounded-xl p-4">
                <img
                  src={kit.posterImageUrl}
                  alt="Kit poster"
                  className="w-full sm:w-28 h-36 rounded-lg object-cover border border-border/50 bg-muted shrink-0 shadow-sm"
                />
                <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
                  <div>
                    <p className="text-xs font-bold text-foreground">Promotional Poster</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      High-resolution promotional banner for WhatsApp status, Instagram stories, and social feeds.
                    </p>
                  </div>
                  <a href={kit.posterImageUrl} target="_blank" rel="noopener noreferrer" download className="inline-block pt-1">
                    <Button variant="outline" size="sm" className="h-8 text-xs font-medium">
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Download Poster
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Attached Files & Resources Section */}
          {kit.assets && kit.assets.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border/40">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Attached Files &amp; Resources ({kit.assets.length})
              </h4>
              <div className="grid grid-cols-1 gap-2.5">
                {kit.assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
                        <Paperclip className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{asset.label}</p>
                        {asset.mimeType && <p className="text-[10px] text-muted-foreground truncate">{asset.mimeType}</p>}
                      </div>
                    </div>
                    <a href={asset.fileUrl} target="_blank" rel="noopener noreferrer" download>
                      <Button variant="outline" size="sm" className="h-8 text-xs">
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Download
                      </Button>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-muted/30 border-t border-border/40 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

