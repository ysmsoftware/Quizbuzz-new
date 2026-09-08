'use client';

import { useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, QrCode, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ReferralQrModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignName: string;
  organizationName?: string;
  ambassadorName?: string;
  referralLink: string;
}

export function ReferralQrModal({
  open,
  onOpenChange,
  campaignName,
  organizationName,
  ambassadorName,
  referralLink,
}: ReferralQrModalProps) {
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<HTMLDivElement>(null);

  const referralCode = useMemo(() => {
    try {
      const url = new URL(referralLink);
      return url.searchParams.get('ref') || '';
    } catch {
      const match = referralLink.match(/[?&]ref=([^&]+)/);
      return match ? match[1] : '';
    }
  }, [referralLink]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Referral link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQrCard = () => {
    try {
      const svgElement = svgRef.current?.querySelector('svg');
      if (!svgElement) return;

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);

      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      logoImg.src = '/qbfavicon.png';

      const image = new Image();
      image.onload = () => {
        const width = 660;
        const height = 880;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 1. Dark Emerald Gradient Card Background (No blue hues)
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#061c14');
        gradient.addColorStop(1, '#020d09');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Border highlight (Emerald accent tint)
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, width - 2, height - 2);

        // Top Emerald & Amber Dual Accent Bar
        ctx.fillStyle = '#10b981';
        ctx.fillRect(0, 0, width * 0.6, 8);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(width * 0.6, 0, width * 0.4, 8);

        // QuizBuzz Ambassador Badge (No emojis)
        ctx.font = 'bold 15px Inter, sans-serif';
        ctx.fillStyle = '#10b981';
        ctx.textAlign = 'center';
        ctx.fillText('QUIZBUZZ AMBASSADOR', width / 2, 48);

        // Campaign Name
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        let title = campaignName;
        const maxTitleWidth = width - 80;
        if (ctx.measureText(title).width > maxTitleWidth) {
          title = title.substring(0, 28) + '...';
        }
        ctx.fillText(title, width / 2, 86);

        // Organization Subtitle
        if (organizationName) {
          ctx.font = '14px Inter, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(organizationName, width / 2, 112);
        }

        // 2. White QR Plate Container Box
        const qrBoxSize = 380;
        const qrBoxX = (width - qrBoxSize) / 2;
        const qrBoxY = 140;
        const radius = 24;

        ctx.beginPath();
        ctx.moveTo(qrBoxX + radius, qrBoxY);
        ctx.arcTo(qrBoxX + qrBoxSize, qrBoxY, qrBoxX + qrBoxSize, qrBoxY + qrBoxSize, radius);
        ctx.arcTo(qrBoxX + qrBoxSize, qrBoxY + qrBoxSize, qrBoxX, qrBoxY + qrBoxSize, radius);
        ctx.arcTo(qrBoxX, qrBoxY + qrBoxSize, qrBoxX, qrBoxY, radius);
        ctx.arcTo(qrBoxX, qrBoxY, qrBoxX + qrBoxSize, qrBoxY, radius);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // 3. Draw QR Code inside white plate
        const qrPadding = 30;
        const qrDrawSize = qrBoxSize - qrPadding * 2;
        const qrDrawX = qrBoxX + qrPadding;
        const qrDrawY = qrBoxY + qrPadding;

        ctx.drawImage(
          image,
          qrDrawX,
          qrDrawY,
          qrDrawSize,
          qrDrawSize
        );

        // Draw centered logo on canvas naturally matching its native shape
        if (logoImg.complete && logoImg.naturalWidth !== 0) {
          const logoSize = 64;
          const logoX = qrDrawX + (qrDrawSize - logoSize) / 2;
          const logoY = qrDrawY + (qrDrawSize - logoSize) / 2;

          ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
        }

        // 4. Instruction text below QR box (No emojis)
        ctx.font = '500 14px Inter, sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.fillText('Scan with phone camera to register', width / 2, qrBoxY + qrBoxSize + 36);

        // 5. Referral Code Badge (Emerald & Amber theme)
        let nextY = qrBoxY + qrBoxSize + 66;
        if (referralCode) {
          const pillText = `Referral Code: ${referralCode}`;
          ctx.font = 'bold 16px Inter, sans-serif';
          const textWidth = ctx.measureText(pillText).width;
          const pillWidth = textWidth + 40;
          const pillHeight = 42;
          const pillX = (width - pillWidth) / 2;
          const pillRadius = 12;

          ctx.beginPath();
          ctx.moveTo(pillX + pillRadius, nextY);
          ctx.arcTo(pillX + pillWidth, nextY, pillX + pillWidth, nextY + pillHeight, pillRadius);
          ctx.arcTo(pillX + pillWidth, nextY + pillHeight, pillX, nextY + pillHeight, pillRadius);
          ctx.arcTo(pillX, nextY + pillHeight, pillX, nextY, pillRadius);
          ctx.arcTo(pillX, nextY, pillX + pillWidth, nextY, pillRadius);
          ctx.closePath();
          ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
          ctx.fill();
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(pillText, width / 2, nextY + 26);
          nextY += 60;
        }

        // 6. Ambassador Name Badge (Underneath Referral Code badge)
        if (ambassadorName) {
          ctx.font = 'bold 15px Inter, sans-serif';
          ctx.fillStyle = '#f59e0b'; // Amber/Gold accent color
          ctx.textAlign = 'center';
          ctx.fillText(`Ambassador: ${ambassadorName}`, width / 2, nextY);
        }

        // 7. Footer Watermark: QuizBuzz / by YSM Info Solution
        ctx.font = 'bold 18px Inter, sans-serif';
        ctx.fillStyle = '#10b981';
        ctx.textAlign = 'center';
        ctx.fillText('QuizBuzz', width / 2, height - 34);

        ctx.font = '500 12px Inter, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText('by YSM Info Solution', width / 2, height - 16);

        // Export PNG file download
        const png = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = png;
        const filename = `${campaignName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-qr-card.png`;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(blobURL);
        toast.success('Downloaded QR share card!');
      };
      image.src = blobURL;
    } catch {
      toast.error('Failed to download QR code card');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border/80 bg-card shadow-2xl rounded-2xl">
        {/* Emerald & Amber Dual Accent Bar */}
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-primary to-amber-500" />

        <div className="p-6 space-y-4 text-center">
          {/* Centered Header (Top icon removed for better vertical space) */}
          <DialogHeader className="text-center space-y-1 flex flex-col items-center">
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground text-center">
              Ambassador Referral QR Code
            </DialogTitle>
            <p className="text-xs text-muted-foreground text-center">
              <span className="font-semibold text-foreground">{campaignName}</span>
              {organizationName ? ` · ${organizationName}` : ''}
            </p>
          </DialogHeader>

          {/* Centered QR Card Plate */}
          <div className="flex flex-col items-center justify-center space-y-3 mx-auto">
            <div
              ref={svgRef}
              className="p-5 rounded-2xl bg-white shadow-xl border border-border/40 transition-transform hover:scale-[1.02] flex items-center justify-center"
            >
              <QRCodeSVG
                value={referralLink}
                size={220}
                bgColor="#ffffff"
                fgColor="#09090b"
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: '/qbfavicon.png',
                  height: 46,
                  width: 46,
                  excavate: false,
                }}
              />
            </div>
            <p className="text-xs font-medium text-muted-foreground flex items-center justify-center gap-1.5 text-center pt-1">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              Scan with phone camera to open referral link directly
            </p>
          </div>

          {/* Referral Code & Ambassador Info */}
          <div className="space-y-2 pt-1 flex flex-col items-center">
            {referralCode && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-xs font-semibold text-foreground">
                <span className="text-muted-foreground font-normal">Referral Code:</span>
                <span className="font-mono text-primary uppercase">{referralCode}</span>
              </div>
            )}

            {ambassadorName && (
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                Ambassador: {ambassadorName}
              </p>
            )}

            <div className="w-full pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="w-full gap-2 text-xs font-semibold h-9 border-primary/30 text-primary hover:bg-primary/10"
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Referral Link Copied!' : 'Copy Referral Link'}
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 pt-2 border-t border-border/60">
            <Button
              variant="default"
              className="flex-1 gap-2 text-xs font-bold h-10 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleDownloadQrCard}
            >
              <Download className="h-4 w-4" />
              Download QR Card
            </Button>
            <Button
              variant="secondary"
              className="text-xs font-semibold h-10 px-5"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>

          {/* Footer Branding Watermark */}
          <div className="pt-1 text-center flex flex-col items-center">
            <p className="text-base font-extrabold text-primary tracking-tight">QuizBuzz</p>
            <p className="text-xs text-muted-foreground font-medium">by YSM Info Solution</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
