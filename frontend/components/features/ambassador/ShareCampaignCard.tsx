'use client';

import { useState } from 'react';
import { Check, Copy, MessageCircle, Radio } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { shareToWhatsApp } from '@/lib/utils/whatsapp-share';

interface ShareCampaignCardProps {
  campaignName: string;
  organizationName?: string;
  contestTitle?: string;
  isLive?: boolean;
  referralLink: string; // {frontendUrl}/contests/{slug}/register?ref={code}
  whatsappText: string; // from campaign.shareTemplates, {referralLink} already interpolated
  /** Shown as the card's header image when set — the actual campaign poster, not a generic
   *  icon, so "quick share" previews what you're actually about to send. */
  posterImageUrl?: string;
}

/** Sidebar "quick share" card — a small preview of what gets sent (image header, campaign
 *  name, the actual message text) plus one-tap WhatsApp/copy, for fast access without
 *  scrolling down to the full Ambassador Kit section. */
export function ShareCampaignCard({
  campaignName,
  organizationName,
  contestTitle,
  isLive,
  referralLink,
  whatsappText,
  posterImageUrl,
}: ShareCampaignCardProps) {
  const [textCopied, setTextCopied] = useState(false);
  const [sending, setSending] = useState(false);

  const copyText = () => {
    navigator.clipboard.writeText(whatsappText);
    setTextCopied(true);
    toast.success('Message copied to clipboard');
    setTimeout(() => setTextCopied(false), 2000);
  };

  const shareWhatsApp = async () => {
    setSending(true);
    try {
      const result = await shareToWhatsApp({ text: whatsappText, posterImageUrl, title: campaignName });
      if (result === 'shared') {
        toast.success('Shared — message and poster sent together');
      } else if (result === 'clipboard') {
        toast.success('Poster copied — paste it (⌘V / Ctrl+V) into the chat before sending', { duration: 5000 });
      } else if (result === 'text-only' && posterImageUrl) {
        toast.info('WhatsApp opened with the message — attach the poster manually, it couldn\'t be added automatically', {
          duration: 5000,
        });
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="overflow-hidden border-border/50 py-0 gap-0">
      <div className="relative h-[104px] flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary/25 to-accent/40">
        {posterImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote S3 poster, not a static app asset
          <img src={posterImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <MessageCircle className="h-8 w-8 text-card/90" strokeWidth={1.6} aria-hidden="true" />
        )}
        {isLive && (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 text-[10px] font-bold text-success-foreground bg-success/90 rounded-full px-2 py-1">
            <Radio className="h-2.5 w-2.5" />
            Live
          </span>
        )}
      </div>

      <CardContent className="pt-3.5 pb-4">
        <p className="text-sm font-bold text-foreground truncate">{campaignName}</p>
        {(organizationName || contestTitle) && (
          <p className="text-[11px] text-muted-foreground truncate mb-3">
            {[organizationName, contestTitle].filter(Boolean).join(' · ')}
          </p>
        )}

        <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Quick share message</p>
        <p className="text-xs leading-relaxed bg-muted rounded-lg px-3 py-2.5 text-foreground line-clamp-4">{whatsappText}</p>

        <div className="flex items-center gap-2 mt-3">
          <Button
            size="sm"
            className="flex-1 bg-success text-success-foreground hover:bg-success/90"
            disabled={sending}
            onClick={shareWhatsApp}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {sending ? 'Preparing…' : 'WhatsApp'}
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={copyText}>
            {textCopied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            Copy
          </Button>
        </div>

        <div className="flex items-center gap-2.5 mt-3.5 pt-3.5 border-t border-border/60">
          {/* White plate behind the code so it stays scannable in dark mode too. */}
          <div className="rounded-md bg-white p-1 shrink-0">
            <QRCodeSVG value={referralLink} size={34} bgColor="#ffffff" fgColor="#0a0a0a" level="M" />
          </div>
          <p className="text-[11px] text-muted-foreground">Scan to open the same link</p>
        </div>
      </CardContent>
    </Card>
  );
}
