'use client';

import { Copy, MessageCircle, Mail, Share2, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { Registration } from '@/lib/types';

interface ParticipantDetailDrawerProps {
  registration: Registration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contestTitle?: string;
}

export function ParticipantDetailDrawer({
  registration,
  open,
  onOpenChange,
  contestTitle = 'Quiz'
}: ParticipantDetailDrawerProps) {
  if (!registration) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(registration.participantId);
    toast.success('Participant ID copied');
  };

  const handleShareWhatsApp = () => {
    const text = `Check out this quiz: ${registration.participantId}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const { fullName, email, phone, institution, city, state, country, dateOfBirth } =
    registration.participantDetails;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-96">
        <SheetHeader>
          <SheetTitle>Participant Details</SheetTitle>
          <SheetDescription>Review participant information and take actions</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-3">Basic Information</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Name</p>
                  <p className="font-medium">{fullName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Participant ID</p>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="font-mono text-sm">{registration.participantId}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyId}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {dateOfBirth && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Date of Birth</p>
                    <p className="font-medium text-sm">
                      {new Date(dateOfBirth).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Contact Info */}
            <div>
              <h3 className="font-semibold mb-3">Contact Information</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
                  <p className="font-medium text-sm">{email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Phone</p>
                  <p className="font-medium text-sm">{phone}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Education & Location */}
            <div>
              <h3 className="font-semibold mb-3">Education & Location</h3>
              <div className="space-y-3">
                {institution && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Institution</p>
                    <p className="font-medium text-sm">{institution}</p>
                  </div>
                )}
                {(city || state || country) && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Location</p>
                    <p className="font-medium text-sm">
                      {[city, state, country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Registration Status */}
            <div>
              <h3 className="font-semibold mb-3">Registration Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={registration.status === 'confirmed' ? 'default' : 'secondary'}>
                    {registration.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment Status</span>
                  <Badge variant={registration.paymentStatus === 'completed' ? 'default' : 'outline'}>
                    {registration.paymentStatus}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Registered</p>
                  <p className="text-sm font-medium">
                    {new Date(registration.registeredAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-2">
            <h3 className="font-semibold mb-3 text-sm">Quick Actions</h3>
            <Button variant="outline" className="w-full justify-start" size="sm">
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm">
              <MessageCircle className="h-4 w-4 mr-2" />
              Send WhatsApp
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              size="sm"
              onClick={handleShareWhatsApp}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share Link
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
