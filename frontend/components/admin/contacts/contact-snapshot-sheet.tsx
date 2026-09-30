'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Building2, ExternalLink, GraduationCap, Mail, MapPin, MessageSquare, Phone, Trophy } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useContact } from '@/lib/hooks/useContact';
import { CertificateBadge, ParticipantStatusBadge, PaymentBadge, formatInr, initials } from './contact-badges';

interface Props {
  contactId: string | null;
  onOpenChange: (open: boolean) => void;
  onSendMessage?: (contactId: string) => void;
}

/** Side drawer with a contact's details and a compact participation list — opened from the contacts table. */
export function ContactSnapshotSheet({ contactId, onOpenChange, onSendMessage }: Props) {
  const { contact, history, isLoadingContact, isLoadingHistory } = useContact(contactId ?? '', {
    enabled: !!contactId,
    loadHistory: true,
  });

  const paidTotal = (history ?? []).reduce((sum, h) => sum + (h.payment?.status === 'SUCCESS' ? h.payment.amount ?? 0 : 0), 0);
  const certCount = (history ?? []).filter((h) => h.certificate?.status === 'GENERATED').length;

  return (
    <Sheet open={!!contactId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 gap-0 overflow-y-auto">
        {isLoadingContact || !contact ? (
          <div className="p-6 space-y-4 animate-pulse">
            <SheetTitle className="sr-only">Loading contact</SheetTitle>
            <div className="h-16 w-16 rounded-2xl bg-secondary" />
            <div className="h-5 w-40 rounded bg-secondary" />
            <div className="h-24 rounded-xl bg-secondary/60" />
          </div>
        ) : (
          <>
            <SheetHeader className="p-6 pb-4 border-b border-border/50">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-black text-primary">
                  {initials(contact.firstName, contact.lastName)}
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-lg font-black truncate">{contact.firstName} {contact.lastName}</SheetTitle>
                  <SheetDescription className="text-xs">
                    Contact since {format(new Date(contact.createdAt), 'MMM d, yyyy')}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="p-6 space-y-6">
              <dl className="space-y-3 text-sm">
                <Row icon={Mail} value={contact.email} />
                <Row icon={Phone} value={contact.phone} />
                <Row icon={Building2} value={contact.college} />
                <Row icon={GraduationCap} value={contact.department} />
                <Row icon={MapPin} value={[contact.city, contact.state].filter(Boolean).join(', ')} />
              </dl>

              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Contests" value={history?.length ?? 0} />
                <Stat label="Paid" value={formatInr(paidTotal)} />
                <Stat label="Certificates" value={certCount} />
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Participation</p>
                {isLoadingHistory ? (
                  <div className="h-16 rounded-xl bg-secondary/40 animate-pulse" />
                ) : !history?.length ? (
                  <p className="text-sm text-muted-foreground italic">No contest registrations yet.</p>
                ) : (
                  history.slice(0, 5).map((h) => (
                    <div key={h.participantId} className="rounded-xl border border-border/50 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold leading-tight">{h.contestTitle}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{h.registrationRef}</p>
                        </div>
                        {h.submission && (
                          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold">
                            <Trophy className="h-3 w-3 text-amber-500" />
                            {h.submission.score}{h.submission.rank ? ` · #${h.submission.rank}` : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <ParticipantStatusBadge status={h.status} />
                        <PaymentBadge item={h} />
                        <CertificateBadge certificate={h.certificate} />
                      </div>
                    </div>
                  ))
                )}
                {(history?.length ?? 0) > 5 && (
                  <p className="text-xs text-muted-foreground">+{history!.length - 5} more on the full profile</p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button asChild className="flex-1 rounded-xl">
                  <Link href={`/org/contacts/${contact.id}`}>
                    <ExternalLink className="h-4 w-4 mr-2" /> Full profile
                  </Link>
                </Button>
                {onSendMessage && (
                  <Button variant="outline" className="rounded-xl" onClick={() => onSendMessage(contact.id)}>
                    <MessageSquare className="h-4 w-4 mr-2" /> Message
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ icon: Icon, value }: { icon: React.ElementType; value?: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
      <dd className={value ? 'break-words min-w-0' : 'text-muted-foreground italic'}>{value || 'Not specified'}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-3">
      <p className="text-base font-black">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
