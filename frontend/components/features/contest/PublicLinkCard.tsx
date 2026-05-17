'use client';

import { useCallback, useRef, useState } from 'react';
import { Copy, Download, Share2, MessageCircle, Twitter, Linkedin, Mail } from 'lucide-react';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { generateQRCode, downloadQRCode, getShareableLinks } from '@/lib/utils/certificates';

interface PublicLinkCardProps {
  contestId: string;
  orgSlug: string;
  contestSlug: string;
  contestTitle: string;
}

export function PublicLinkCard({
  contestId,
  orgSlug,
  contestSlug,
  contestTitle
}: PublicLinkCardProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL}/${orgSlug}/${contestSlug}`;

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Link copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy link');
    }
  }, [publicUrl]);

  const handleDownloadQR = useCallback(async () => {
    try {
      setLoading(true);
      await downloadQRCode(publicUrl, `${contestSlug}-qr.png`);
      toast.success('QR code downloaded');
    } catch (err) {
      toast.error('Failed to download QR code');
    } finally {
      setLoading(false);
    }
  }, [publicUrl, contestSlug]);

  const shareLinks = getShareableLinks(publicUrl);

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Share Contest</CardTitle>
        <CardDescription>Share this link to invite participants</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Contest URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Contest URL</label>
          <div className="flex gap-2">
            <Input
              value={publicUrl}
              readOnly
              className="bg-muted"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyUrl}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* QR Code */}
        <div className="space-y-2">
          <label className="text-sm font-medium">QR Code</label>
          <div
            ref={qrRef}
            className="flex justify-center p-4 bg-muted rounded-lg"
          >
            <QRCode
              value={publicUrl}
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleDownloadQR}
            disabled={loading}
          >
            <Download className="h-4 w-4 mr-2" />
            {loading ? 'Downloading...' : 'Download QR Code'}
          </Button>
        </div>

        {/* Social Share */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Share On</label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(shareLinks.whatsapp, '_blank')}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(shareLinks.twitter, '_blank')}
            >
              <Twitter className="h-4 w-4 mr-2" />
              Twitter
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(shareLinks.linkedin, '_blank')}
            >
              <Linkedin className="h-4 w-4 mr-2" />
              LinkedIn
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(shareLinks.email, '_blank')}
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
