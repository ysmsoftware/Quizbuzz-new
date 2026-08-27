'use client';

import { useState } from 'react';
import { Check, Copy, Download, Gift, MessageCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CopyIconButton } from './CopyIconButton';
import { fillShareTemplate, type ShareTemplateValues } from '@/lib/utils/share-template';
import { shareToWhatsApp } from '@/lib/utils/whatsapp-share';
import type { ShareTemplates } from '@/lib/types/ambassador';

interface AmbassadorKitCardProps {
  shareTemplates: ShareTemplates;
  /** Every {referralLink}/{ambassadorName}/{contestName} token a template can contain (see
   *  ShareTemplatesEditor.tsx), already resolved to this ambassador's real values — so what
   *  renders here is exactly the message that gets sent, not the raw placeholder text. */
  values: ShareTemplateValues;
  /** Used as the Web Share API's title and to label the poster file when a template's
   *  "attach the poster" switch is on. */
  campaignName?: string;
}

/** Ready-to-send share assets, separate from the reward-tier ladder above. Tabbed by kind
 *  (WhatsApp / Instagram / Poster) once more than one is configured — a single configured
 *  kind renders directly, no pointless one-tab switcher. */
export function AmbassadorKitCard({ shareTemplates, values, campaignName }: AmbassadorKitCardProps) {
  const { referralLink } = values;
  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleShare = async (templateId: string, text: string, includePoster: boolean) => {
    setSendingId(templateId);
    try {
      const result = await shareToWhatsApp({
        text,
        posterImageUrl: includePoster ? shareTemplates.posterImageUrl : undefined,
        title: campaignName,
      });
      if (result === 'shared') {
        toast.success('Shared — message and poster sent together');
      } else if (result === 'clipboard') {
        toast.success('Poster copied — paste it (⌘V / Ctrl+V) into the chat before sending', { duration: 5000 });
      } else if (result === 'text-only' && includePoster && shareTemplates.posterImageUrl) {
        toast.info('WhatsApp opened with the message — attach the poster manually, it couldn\'t be added automatically', {
          duration: 5000,
        });
      }
    } finally {
      setSendingId(null);
    }
  };
  const templates = shareTemplates.whatsappTemplates?.length
    ? shareTemplates.whatsappTemplates
    : shareTemplates.whatsappText
      ? [{ id: 'primary', label: 'WhatsApp message', text: shareTemplates.whatsappText, includePoster: false }]
      : [];
  const filledTemplates = templates.map((t) => ({ ...t, text: fillShareTemplate(t.text, values) }));
  const instagramText = shareTemplates.instagramText ? fillShareTemplate(shareTemplates.instagramText, values) : undefined;
  const hasPoster = !!shareTemplates.posterImageUrl;

  const tabs = [
    filledTemplates.length > 0 && { value: 'whatsapp', label: 'WhatsApp' },
    instagramText && { value: 'instagram', label: 'Instagram' },
    hasPoster && { value: 'poster', label: 'Poster' },
  ].filter((t): t is { value: string; label: string } => !!t);

  const [linkCopied, setLinkCopied] = useState(false);
  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setLinkCopied(true);
    toast.success('Link copied');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <Card className="border-border/50">
      <CardContent className="space-y-3.5">
        {tabs.length === 0 ? (
          <Empty className="py-8">
            <EmptyMedia variant="icon">
              <Gift className="h-5 w-5" />
            </EmptyMedia>
            <EmptyTitle className="text-sm">No kit assets yet</EmptyTitle>
            <EmptyDescription className="text-xs">The organizer hasn&apos;t added share templates for this campaign.</EmptyDescription>
          </Empty>
        ) : tabs.length === 1 ? (
          <KitTabContent
            tab={tabs[0].value}
            filledTemplates={filledTemplates}
            instagramText={instagramText}
            posterImageUrl={shareTemplates.posterImageUrl}
            sendingId={sendingId}
            onShare={handleShare}
          />
        ) : (
          <Tabs defaultValue={tabs[0].value}>
            <TabsList>
              {tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((t) => (
              <TabsContent key={t.value} value={t.value} className="space-y-3.5">
                <KitTabContent
                  tab={t.value}
                  filledTemplates={filledTemplates}
                  instagramText={instagramText}
                  posterImageUrl={shareTemplates.posterImageUrl}
                  sendingId={sendingId}
                  onShare={handleShare}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}

        <div className="flex items-center gap-2.5 pt-3.5 border-t border-border/60">
          <div className="flex-1 min-w-0 bg-muted rounded-lg px-3 py-2">
            <span className="text-xs font-mono text-muted-foreground truncate block">{referralLink}</span>
          </div>
          <Button variant="outline" size="icon" onClick={copyLink} aria-label="Copy referral link">
            {linkCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </Button>
          <div className="rounded-md bg-white p-1 shrink-0">
            <QRCodeSVG value={referralLink} size={32} bgColor="#ffffff" fgColor="#0a0a0a" level="M" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface KitTabContentProps {
  tab: string;
  filledTemplates: { id: string; label: string; text: string; includePoster: boolean }[];
  instagramText?: string;
  posterImageUrl?: string;
  sendingId: string | null;
  onShare: (templateId: string, text: string, includePoster: boolean) => void;
}

function KitTabContent({ tab, filledTemplates, instagramText, posterImageUrl, sendingId, onShare }: KitTabContentProps) {
  if (tab === 'whatsapp') {
    return (
      <>
        {filledTemplates.map((t) => (
          <div key={t.id} className="rounded-xl border border-border/60 p-4">
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{t.label}</p>
                <p className="text-[11px] text-muted-foreground">WhatsApp template</p>
              </div>
              <CopyIconButton text={t.text} label={`${t.label} copied`} />
            </div>
            <p className="text-sm leading-relaxed bg-muted rounded-lg px-3.5 py-3 text-foreground whitespace-pre-line">{t.text}</p>
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                className="bg-success text-success-foreground hover:bg-success/90"
                disabled={sendingId === t.id}
                onClick={() => onShare(t.id, t.text, t.includePoster)}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {sendingId === t.id ? 'Preparing…' : 'Share via WhatsApp'}
              </Button>
            </div>
          </div>
        ))}
      </>
    );
  }

  if (tab === 'instagram') {
    return (
      <div className="rounded-xl border border-border/60 p-4">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Instagram caption</p>
            <p className="text-[11px] text-muted-foreground">Text template</p>
          </div>
          <CopyIconButton text={instagramText ?? ''} label="Caption copied" />
        </div>
        <p className="text-sm leading-relaxed bg-muted rounded-lg px-3.5 py-3 text-foreground whitespace-pre-line">{instagramText}</p>
      </div>
    );
  }

  if (tab === 'poster' && posterImageUrl) {
    return (
      <div className="flex gap-4">
        <img
          src={posterImageUrl}
          alt="Campaign poster"
          className="w-[92px] h-[116px] rounded-xl border border-border/60 object-cover shrink-0 bg-muted"
        />
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-sm font-bold text-foreground mb-0.5">Campaign poster</p>
          <p className="text-xs text-muted-foreground mb-2.5">Shareable graphic, ready to post</p>
          <a href={posterImageUrl} download className="inline-block w-fit">
            <Button variant="outline" size="sm">
              <Download className="h-3.5 w-3.5" />
              Download poster
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return null;
}
