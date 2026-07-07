'use client';

import React from 'react';
import {
    Filter,
    CalendarIcon,
    Copy,
    ExternalLink,
    MessageCircle,
    Mail,
    X,
    Loader2,
    Trash2,
    ShieldAlert,
    CreditCard,
    User,
} from 'lucide-react';
import { format } from 'date-fns';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetClose,
    SheetFooter,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, toDateOrNull } from '@/lib/utils';
import { toast } from 'sonner';
import type { Registration } from '@/lib/types';

// ─── Helper Sub-components ─────────────────────────────────────────────────────

export function DetailSection({
    title,
    icon,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
                {icon}
                <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
            </div>
            {children}
        </div>
    );
}

export function DetailItem({
    label,
    value,
    mono,
    copyable,
}: {
    label: string;
    value: React.ReactNode;
    mono?: boolean;
    copyable?: boolean;
}) {
    return (
        <div className="flex flex-col gap-0.5 group">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                {label}
            </span>
            <div className="flex items-center gap-2">
                <span className={cn('text-sm font-medium', mono && 'font-mono')}>{value}</span>
                {copyable && typeof value === 'string' && (
                    <button
                        className="p-1 rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                            navigator.clipboard.writeText(value);
                            toast.success(`${label} copied!`);
                        }}
                    >
                        <Copy className="h-3 w-3 text-muted-foreground" />
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface ParticipantDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    registration: Registration | null;
    contest: any;
    phase: string;
    isLoading?: boolean;
    onMarkAsPaid: (ref: string) => void;
    onAllowFree: () => void;
    onRevoke: (reason: string) => void;
    onSendMessage: (participantId: string) => void;
}

export function ParticipantDrawer({
    isOpen,
    onClose,
    registration,
    contest,
    phase,
    isLoading = false,
    onMarkAsPaid,
    onAllowFree,
    onRevoke,
    onSendMessage,
}: ParticipantDrawerProps) {
    const registeredAtDate = toDateOrNull(registration?.registeredAt);
    const paidAtDate = toDateOrNull(registration?.paidAt);

    return (
        <>
            <Sheet open={isOpen} onOpenChange={onClose}>
                <SheetContent className="w-full sm:max-w-120 p-0 flex flex-col">
                    <SheetHeader className="p-6 pb-0 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16 border-2 border-primary/20 p-0.5">
                                    <AvatarFallback className="text-xl font-black bg-primary/10 text-primary uppercase">
                                        {isLoading || !registration
                                            ? '…'
                                            : (registration.participantDetails?.fullName || 'P')
                                                  .split(' ')
                                                  .map((n: string) => n[0])
                                                  .join('')
                                                  .slice(0, 2)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    {isLoading ? (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="text-sm">Loading details...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <h3 className="text-xl font-black tracking-tight">
                                                {registration?.participantDetails?.fullName || 'Participant'}
                                            </h3>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    'w-fit text-[10px] uppercase mt-1',
                                                    registration?.status === 'confirmed'
                                                        ? 'border-green-500 text-green-600'
                                                        : 'border-amber-500 text-amber-600',
                                                )}
                                            >
                                                {registration?.status}
                                            </Badge>
                                        </>
                                    )}
                                </div>
                            </div>
                            <SheetClose asChild>
                                <Button variant="ghost" size="icon" className="rounded-full">
                                    <X className="h-5 w-5" />
                                </Button>
                            </SheetClose>
                        </div>

                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm">Fetching participant data...</p>
                            </div>
                        ) : registration ? (
                            <Tabs defaultValue="overview" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 h-9 bg-muted/50 p-1">
                                    <TabsTrigger value="overview" className="text-xs">
                                        Overview
                                    </TabsTrigger>
                                    <TabsTrigger value="payment" className="text-xs">
                                        Payment
                                    </TabsTrigger>
                                </TabsList>

                                <div className="flex-1 overflow-auto mt-6 space-y-8 pb-20 px-1">
                                    <TabsContent value="overview" className="space-y-8 m-0">
                                        <DetailSection
                                            title="Contact Information"
                                            icon={<User className="h-4 w-4" />}
                                        >
                                            <div className="grid grid-cols-2 gap-4">
                                                <DetailItem
                                                    label="Full Name"
                                                    value={
                                                        registration.participantDetails?.fullName ||
                                                        'Participant'
                                                    }
                                                />
                                                <DetailItem
                                                    label="Email"
                                                    value={
                                                        registration.participantDetails?.email || '—'
                                                    }
                                                    copyable
                                                />
                                                <DetailItem
                                                    label="Phone"
                                                    value={
                                                        registration.participantDetails?.phone || '—'
                                                    }
                                                    copyable
                                                />
                                                <DetailItem
                                                    label="City/State"
                                                    value={`${registration.participantDetails?.city || '—'}, ${registration.participantDetails?.state || '—'}`}
                                                />
                                            </div>
                                        </DetailSection>

                                        <DetailSection
                                            title="Registration Details"
                                            icon={<CalendarIcon className="h-4 w-4" />}
                                        >
                                            <div className="grid grid-cols-2 gap-4">
                                                <DetailItem
                                                    label="Registration Ref"
                                                    value={registration.registrationRef}
                                                    mono
                                                    copyable
                                                />
                                                <DetailItem
                                                    label="Participant ID"
                                                    value={registration.participantId}
                                                    mono
                                                    copyable
                                                />
                                                <DetailItem
                                                    label="Registered At"
                                                    value={
                                                        registeredAtDate
                                                            ? format(registeredAtDate, 'PPP p')
                                                            : '—'
                                                    }
                                                />
                                                <DetailItem
                                                    label="WhatsApp Opt-in"
                                                    value={registration.whatsappOptIn ? 'Yes' : 'No'}
                                                />
                                            </div>
                                        </DetailSection>

                                        <DetailSection
                                            title="Custom Fields"
                                            icon={<Filter className="h-4 w-4" />}
                                        >
                                            <div className="grid grid-cols-1 gap-4">
                                                <DetailItem
                                                    label="College/Institution"
                                                    value={
                                                        registration.participantDetails?.institution || '—'
                                                    }
                                                />
                                                {Object.entries(
                                                    registration.customFields || {},
                                                ).map(([key, value]) => (
                                                    <DetailItem key={key} label={key} value={value as any} />
                                                ))}
                                            </div>
                                        </DetailSection>

                                        {(phase === 'REGISTRATION_CLOSED' || phase === 'LIVE') && (
                                            <DetailSection
                                                title="Contest Join Link"
                                                icon={<ExternalLink className="h-4 w-4" />}
                                            >
                                                <div className="p-3 bg-muted/30 rounded-xl border border-border/50 flex items-center justify-between gap-3">
                                                    <span className="text-xs truncate font-mono text-muted-foreground">
                                                        quizBuzz.pro/quiz/{contest?.orgSlug}/
                                                        {contest?.slug}/enter
                                                    </span>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 shrink-0"
                                                        onClick={() =>
                                                            toast.success('Link copied!')
                                                        }
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </DetailSection>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="payment" className="space-y-8 m-0">
                                        <div className="flex flex-col items-center justify-center py-6 bg-primary/5 rounded-2xl border border-primary/10">
                                            <Badge
                                                className={cn(
                                                    'mb-3 uppercase text-[10px] text-white',
                                                    !contest?.fee ||
                                                    contest.fee === 0 ||
                                                    registration.paymentStatus === 'completed'
                                                        ? 'bg-green-500'
                                                        : 'bg-amber-500',
                                                )}
                                            >
                                                {!contest?.fee || contest.fee === 0
                                                    ? 'Confirmed'
                                                    : registration.paymentStatus}
                                            </Badge>
                                            <span className="text-4xl font-black">
                                                {!contest?.fee || contest.fee === 0
                                                    ? 'Free'
                                                    : `₹${registration.amount || contest.fee}`}
                                            </span>
                                            {contest?.fee && contest.fee > 0 && (
                                                <span className="text-xs text-muted-foreground mt-1">
                                                    Payment Method:{' '}
                                                    {registration.paymentMethod || 'Razorpay'}
                                                </span>
                                            )}
                                        </div>

                                        {contest?.fee && contest.fee > 0 && (
                                            <>
                                                <DetailSection
                                                    title="Transaction History"
                                                    icon={<CreditCard className="h-4 w-4" />}
                                                >
                                                    <div className="space-y-4">
                                                        <DetailItem
                                                            label="Payment ID"
                                                            value={registration.paymentId || '—'}
                                                            mono
                                                            copyable
                                                        />
                                                        <DetailItem
                                                            label="Transaction Date"
                                                            value={
                                                                paidAtDate
                                                                    ? format(paidAtDate, 'PPP p')
                                                                    : '—'
                                                            }
                                                        />
                                                    </div>
                                                </DetailSection>

                                                {registration.paymentStatus === 'failed' && (
                                                    <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 space-y-4">
                                                        <div className="flex items-center gap-3 text-destructive">
                                                            <ShieldAlert className="h-5 w-5" />
                                                            <span className="text-sm font-bold">
                                                                Reason: Payment declined by bank
                                                            </span>
                                                        </div>
                                                        <Button
                                                            variant="outline"
                                                            className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                                                            onClick={onAllowFree}
                                                        >
                                                            Allow Free Entry
                                                        </Button>
                                                    </div>
                                                )}

                                                {registration.paymentStatus === 'pending' && (
                                                    <Button
                                                        className="w-full"
                                                        onClick={() => {
                                                            const ref = prompt(
                                                                'Enter reference (Cash/Cheque ID):',
                                                            );
                                                            if (ref) onMarkAsPaid(ref);
                                                        }}
                                                    >
                                                        Mark as Manually Paid
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </TabsContent>
                                </div>
                            </Tabs>
                        ) : null}
                    </SheetHeader>

                    {!isLoading && registration && (
                        <SheetFooter className="mt-auto p-6 border-t bg-muted/5 grid grid-cols-2 gap-3">
                            <Button
                                className="bg-[#25D366] hover:bg-[#20ba5a] text-white"
                                onClick={() => {
                                    if (registration) onSendMessage(registration.id);
                                }}
                            >
                                <MessageCircle className="mr-2 h-4 w-4" />
                                WhatsApp
                            </Button>
                            <Button
                                variant="outline"
                                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() => {
                                    if (registration) onSendMessage(registration.id);
                                }}
                            >
                                <Mail className="mr-2 h-4 w-4" />
                                Email
                            </Button>
                            <Button
                                variant="ghost"
                                className="col-span-2 text-destructive hover:bg-destructive/5"
                                onClick={() => {
                                    const reason = prompt('Reason for revoking:');
                                    if (reason) onRevoke(reason);
                                }}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Revoke Registration
                            </Button>
                        </SheetFooter>
                    )}
                </SheetContent>
            </Sheet>
        </>
    );
}
