'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/** Copy-to-clipboard icon button with the copy → checkmark → copy transition — shared by
 *  ShareCampaignCard and RewardsKitTab so that feedback pattern isn't hand-rolled per caller. */
export function CopyIconButton({ text, label = 'Copied', className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(label);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy"
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:bg-muted transition-colors shrink-0',
        className
      )}
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}
