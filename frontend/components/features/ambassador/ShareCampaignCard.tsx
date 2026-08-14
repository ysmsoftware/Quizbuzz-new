'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, Share2, MessageCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface ShareCampaignCardProps {
  campaignName: string;
  referralLink: string; // {frontendUrl}/contests/{slug}/register?ref={code}
  whatsappText: string; // from campaign.shareTemplates, {referralLink} already interpolated
  posterImageUrl?: string;
}

function buildWhatsAppUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function ShareCampaignCard({ campaignName, referralLink, whatsappText, posterImageUrl }: ShareCampaignCardProps) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [textCopied, setTextCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator.share === 'function');
  }, []);

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setLinkCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const copyText = () => {
    navigator.clipboard.writeText(whatsappText);
    setTextCopied(true);
    toast.success('Message copied to clipboard');
    setTimeout(() => setTextCopied(false), 2000);
  };

  return (
    <Card className="overflow-hidden border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold">Share &amp; Earn</CardTitle>
        <CardDescription>Share your referral link to earn rewards</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Referral Link</label>
          <div className="flex gap-2">
            <Input value={referralLink} readOnly className="bg-muted/50 font-mono text-xs focus-visible:ring-0" />
            <Button size="icon" variant="outline" onClick={copyLink} aria-label="Copy link">
              {linkCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            className="bg-success text-success-foreground hover:bg-success/90 w-full"
            onClick={() => window.open(buildWhatsAppUrl(whatsappText), '_blank')}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Share via WhatsApp
          </Button>
          <Button variant="outline" className="w-full" onClick={copyText}>
            {textCopied ? <Check className="h-4 w-4 mr-2 text-success" /> : <Copy className="h-4 w-4 mr-2" />}
            Copy Message
          </Button>
        </div>

        {canNativeShare && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigator.share({ title: campaignName, text: whatsappText, url: referralLink })}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share…
          </Button>
        )}

        {posterImageUrl && (
          <a
            href={posterImageUrl}
            download
            className="flex items-center justify-center gap-2 text-sm text-primary hover:underline font-medium py-2"
          >
            <Download className="h-4 w-4" />
            Download poster
          </a>
        )}
      </CardContent>
    </Card>
  );
}
