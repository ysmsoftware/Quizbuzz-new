'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Share2, Twitter, Linkedin, Facebook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PublicLinkCardProps {
  url: string;
  isRegistrationClosed?: boolean;
  className?: string;
}

export function PublicLinkCard({ url, isRegistrationClosed = false, className }: PublicLinkCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOptions = [
    { 
      name: 'Twitter', 
      icon: Twitter, 
      color: 'bg-[#1DA1F2]', 
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Check out this contest on QuizCraft!')}` 
    },
    { 
      name: 'LinkedIn', 
      icon: Linkedin, 
      color: 'bg-[#0077B5]', 
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` 
    },
    { 
      name: 'Facebook', 
      icon: Facebook, 
      color: 'bg-[#1877F2]', 
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` 
    },
  ];

  return (
    <Card className={cn("overflow-hidden border-border/50", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold">Public Sharing</CardTitle>
        <CardDescription>Share this link with potential participants</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative group">
          <div className={cn(
            "aspect-square w-full max-w-[200px] mx-auto p-4 bg-white rounded-xl border flex items-center justify-center transition-all",
            isRegistrationClosed && "opacity-50 grayscale"
          )}>
            <QRCodeSVG value={url} size={168} level="H" includeMargin={false} />
            
            {isRegistrationClosed && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-xl">
                <div className="bg-destructive text-destructive-foreground px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider rotate-[-12deg] shadow-lg border-2 border-background">
                  Registration Closed
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Share Link</label>
          <div className="flex gap-2">
            <Input 
              value={url} 
              readOnly 
              className="bg-muted/50 font-mono text-xs focus-visible:ring-0" 
            />
            <Button size="icon" variant="outline" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Social Share</label>
          <div className="flex gap-3">
            {shareOptions.map((option) => (
              <a
                key={option.name}
                href={option.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg text-white transition-transform hover:scale-110 active:scale-95",
                  option.color
                )}
              >
                <option.icon className="h-5 w-5 fill-current" />
              </a>
            ))}
            <Button size="icon" variant="outline" className="ml-auto" onClick={() => {
              if (navigator.share) {
                navigator.share({ title: 'QuizCraft Contest', url });
              }
            }}>
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
