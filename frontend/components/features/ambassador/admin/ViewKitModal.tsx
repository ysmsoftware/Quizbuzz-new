'use client';

import { Download, Eye, FileText, MessageSquare, Paperclip, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { substitutePlaceholders } from '../ShareTemplatesEditor';
import type { ShareKit } from '@/lib/types/ambassador';

interface ViewKitModalProps {
  kit: ShareKit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contestTitle?: string;
  onEdit?: () => void;
}

export function ViewKitModal({ kit, open, onOpenChange, contestTitle, onEdit }: ViewKitModalProps) {
  if (!kit) return null;

  const sampleMessage = substitutePlaceholders(kit.templateText, contestTitle);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/40">
          <div className="flex items-center justify-between gap-3 pr-6">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <MessageSquare className="h-5 w-5 text-primary" />
                {kit.name}
              </DialogTitle>
              {kit.description && (
                <DialogDescription className="text-xs">
                  {kit.description}
                </DialogDescription>
              )}
            </div>
            <Badge variant="outline" className="shrink-0 text-xs">
              Share Kit
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Sample Message Preview */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Message Template Preview
            </h4>
            <div className="bg-muted/40 border border-border/50 rounded-xl p-4 text-xs space-y-2">
              <p className="whitespace-pre-wrap leading-relaxed text-foreground font-sans">
                {sampleMessage || 'No message text template configured.'}
              </p>
            </div>
          </div>

          {/* Primary Poster Preview */}
          {kit.posterImageUrl && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Poster Image
              </h4>
              <div className="flex items-center gap-4 bg-card border border-border/50 rounded-xl p-3">
                <img
                  src={kit.posterImageUrl}
                  alt="Kit poster"
                  className="w-20 h-24 rounded-lg object-cover border border-border/50 bg-muted shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-xs font-medium text-foreground">Promotional Poster / Graphic</p>
                  <a href={kit.posterImageUrl} target="_blank" rel="noopener noreferrer" download>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Download Poster
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* File Assets */}
          {kit.assets && kit.assets.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Attached Resources &amp; Files ({kit.assets.length})
              </h4>
              <div className="space-y-2">
                {kit.assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/50 bg-muted/20 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Paperclip className="h-4 w-4 text-primary" />
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

        <DialogFooter className="p-4 bg-muted/30 border-t border-border/40 flex items-center justify-between">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onEdit && (
            <Button size="sm" onClick={() => { onOpenChange(false); onEdit(); }}>
              Edit Share Kits
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
