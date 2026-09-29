'use client';

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CreditCard, Loader2, ShieldAlert, ShieldCheck, History, Search, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import * as paymentApi from '@/lib/api/payment.api';
import { queryKeys } from '@/lib/api/queryClient';
import { DetailItem, DetailSection } from './ParticipantDrawer';

const SHORT_DATE_TIME = "d MMM ''yy, h:mm:ss a";
const fmt = (d: string | null | undefined) => (d ? format(new Date(d), SHORT_DATE_TIME) : '—');

const STATUS_CLASS: Record<string, string> = {
    SUCCESS: 'bg-green-500',
    FAILED: 'bg-destructive',
    CREATED: 'bg-amber-500',
    PENDING: 'bg-amber-500',
    CANCELLED: 'bg-muted-foreground',
    REFUNDED: 'bg-indigo-500',
};

/**
 * Drawer "Payment" tab body for paid contests: the real payment record, every
 * Razorpay order ever created for this registration, and — when the payment
 * isn't settled — a two-step "verify with Razorpay" flow: look the ID up on
 * Razorpay and review what came back (changes nothing), then explicitly
 * confirm, which settles the registration and emails the participant. The
 * backend re-runs every check on confirm.
 */
export function ParticipantPaymentPanel({
    participantId,
    contestId,
}: {
    participantId: string;
    contestId: string;
}) {
    const queryClient = useQueryClient();
    const [reference, setReference] = React.useState('');
    // The review dialog: what Razorpay returned for `reference`, or why the lookup failed.
    const [review, setReview] = React.useState<
        { reference: string; preview?: paymentApi.RazorpayVerificationPreview; error?: string } | null
    >(null);

    const detailsQuery = useQuery({
        queryKey: queryKeys.payments.details(participantId),
        queryFn: () => paymentApi.getParticipantPaymentDetails(participantId),
    });

    const lookupMutation = useMutation({
        mutationFn: (ref: string) => paymentApi.previewRazorpayPayment(participantId, ref),
        onSuccess: (res, ref) => setReview({ reference: ref, preview: res.data }),
        onError: (err: any, ref) =>
            setReview({ reference: ref, error: err?.message || 'Could not look this ID up on Razorpay.' }),
    });

    const confirmMutation = useMutation({
        mutationFn: (ref: string) => paymentApi.verifyRazorpayPayment(participantId, ref),
        onSuccess: (res) => {
            queryClient.setQueryData(queryKeys.payments.details(participantId), res);
            queryClient.invalidateQueries({ queryKey: ['contests', contestId, 'participants'] });
            queryClient.invalidateQueries({ queryKey: ['contest-status-summary', contestId] });
            setReference('');
            setReview(null);
            toast.success('Registration confirmed — the participant has been emailed.');
        },
        onError: (err: any) => {
            toast.error(err?.message || 'Could not confirm this payment.');
        },
    });

    if (detailsQuery.isLoading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading payment details…
            </div>
        );
    }
    if (detailsQuery.isError) {
        return <p className="text-sm text-destructive">Couldn’t load payment details.</p>;
    }

    const details = detailsQuery.data?.data;
    const payment = details?.payment;
    if (!details || !payment) {
        return <p className="text-sm text-muted-foreground">No payment has been started for this registration yet.</p>;
    }

    const isPaid = payment.status === 'SUCCESS';
    const olderOrders = details.orders.filter((o) => !o.isCurrent);

    return (
        <div className="space-y-8">
            <DetailSection title="Transaction" icon={<CreditCard className="h-4 w-4" />}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailItem
                        label="Status"
                        value={
                            <Badge className={cn('uppercase text-[10px] text-white', STATUS_CLASS[payment.status])}>
                                {payment.status}
                            </Badge>
                        }
                    />
                    <DetailItem label="Amount" value={`₹${(payment.amount / 100).toFixed(2)} ${payment.currency}`} />
                    <DetailItem label="Razorpay Payment ID" value={payment.razorpayPaymentId || '—'} mono copyable />
                    <DetailItem label="Razorpay Order ID (current)" value={payment.razorpayOrderId || '—'} mono copyable />
                    <DetailItem label="Paid At" value={fmt(payment.paidAt)} />
                    <DetailItem label="First Attempt" value={fmt(payment.createdAt)} />
                    <DetailItem label="Last Update" value={fmt(payment.updatedAt)} />
                    <DetailItem label="Orders Created" value={String(Math.max(details.orders.length, payment.attempts))} />
                </div>
            </DetailSection>

            {!isPaid && payment.failureReason && (
                <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 flex items-start gap-3 text-destructive">
                    <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                        <span className="text-sm font-bold block">Reason (from Razorpay)</span>
                        <span className="text-sm">{payment.failureReason}</span>
                    </div>
                </div>
            )}

            <DetailSection title={`Razorpay Orders (${details.orders.length})`} icon={<History className="h-4 w-4" />}>
                {details.orders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No orders recorded.</p>
                ) : (
                    <div className="space-y-3">
                        {[...details.orders].reverse().map((o) => (
                            <div key={o.razorpayOrderId} className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-xs [overflow-wrap:anywhere]">{o.razorpayOrderId}</span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {o.isCurrent && <Badge variant="outline" className="text-[10px]">Current</Badge>}
                                        <Badge className={cn('uppercase text-[10px] text-white', STATUS_CLASS[o.status])}>{o.status}</Badge>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                    <span>Created: {fmt(o.createdAt)}</span>
                                    <span>Updated: {fmt(o.updatedAt)}</span>
                                    {o.razorpayPaymentId && <span className="font-mono [overflow-wrap:anywhere]">Payment: {o.razorpayPaymentId}</span>}
                                    {o.method && <span>Method: {o.method.toUpperCase()}</span>}
                                </div>
                                {o.failureReason && o.status !== 'SUCCESS' && (
                                    <p className="text-xs text-destructive">
                                        {o.failureReason}
                                        {o.errorReason && <span className="text-muted-foreground font-mono"> ({o.errorReason})</span>}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {olderOrders.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                        This registration has {details.orders.length} Razorpay orders. If any was paid and isn’t marked here, it will be picked
                        up automatically — or verify it below.
                    </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <DetailItem label="Razorpay receipt (first order)" value={details.razorpayReceipts.original} mono copyable />
                    <DetailItem label="Razorpay receipt (retry orders)" value={details.razorpayReceipts.retry} mono copyable />
                </div>
            </DetailSection>

            {!isPaid && (
                <div className="p-4 rounded-xl border border-border/60 space-y-3">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <span className="text-sm font-bold">Participant says they paid?</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Enter the Razorpay payment ID (<span className="font-mono">pay_…</span>) or order ID (
                        <span className="font-mono">order_…</span>) from their receipt or your Razorpay dashboard. We’ll fetch it from Razorpay
                        and show you what we found — nothing changes until you confirm.
                    </p>
                    <form
                        className="flex flex-col sm:flex-row gap-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            const ref = reference.trim();
                            if (ref) lookupMutation.mutate(ref);
                        }}
                    >
                        <Input
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            placeholder="pay_… or order_…"
                            className="font-mono text-sm"
                            aria-label="Razorpay payment or order ID"
                            disabled={lookupMutation.isPending}
                        />
                        <Button type="submit" disabled={!reference.trim() || lookupMutation.isPending} className="shrink-0">
                            {lookupMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    <Search className="mr-2 h-4 w-4" /> Look up on Razorpay
                                </>
                            )}
                        </Button>
                    </form>
                </div>
            )}

            <Dialog open={!!review} onOpenChange={(open) => !open && !confirmMutation.isPending && setReview(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {review?.preview ? 'Payment found on Razorpay' : 'Payment not found'}
                        </DialogTitle>
                        <DialogDescription className="font-mono text-xs [overflow-wrap:anywhere]">
                            {review?.reference}
                        </DialogDescription>
                    </DialogHeader>

                    {review?.error && (
                        <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-destructive flex gap-2">
                            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>{review.error}</span>
                        </div>
                    )}

                    {review?.preview && (
                        <RazorpayPreview preview={review.preview} expectedAmount={payment.amount} expectedCurrency={payment.currency} />
                    )}

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setReview(null)} disabled={confirmMutation.isPending}>
                            {review?.preview?.canConfirm ? 'Cancel' : 'Close'}
                        </Button>
                        {review?.preview?.canConfirm && (
                            <Button
                                onClick={() => confirmMutation.mutate(review.reference)}
                                disabled={confirmMutation.isPending}
                            >
                                {confirmMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Confirm registration & send email'
                                )}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/** Razorpay's own record for the looked-up payment, plus each acceptance check — for the admin to cross-check. */
function RazorpayPreview({
    preview,
    expectedAmount,
    expectedCurrency,
}: {
    preview: paymentApi.RazorpayVerificationPreview;
    expectedAmount: number;
    expectedCurrency: string;
}) {
    const r = preview.razorpay;
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
                <DetailItem
                    label="Razorpay status"
                    value={
                        <Badge className={cn('uppercase text-[10px] text-white', r.status === 'captured' ? 'bg-green-500' : 'bg-destructive')}>
                            {r.status}
                        </Badge>
                    }
                />
                <DetailItem
                    label="Amount"
                    value={`₹${(r.amount / 100).toFixed(2)} ${r.currency} (expected ₹${(expectedAmount / 100).toFixed(2)} ${expectedCurrency})`}
                />
                <DetailItem label="Payment ID" value={r.paymentId} mono copyable />
                <DetailItem label="Order ID" value={r.orderId} mono copyable />
                <DetailItem label="Paid on" value={fmt(r.createdAt)} />
                <DetailItem label="Method" value={[r.method?.toUpperCase(), r.vpa].filter(Boolean).join(' · ') || '—'} />
                <DetailItem label="Bank RRN" value={r.bankRrn || '—'} mono copyable />
                <DetailItem label="Payer" value={[r.contact, r.email].filter(Boolean).join(' · ') || '—'} />
                {r.errorDescription && <DetailItem label="Razorpay error" value={r.errorDescription} />}
            </div>

            <ul className="space-y-2">
                {preview.checks.map((c) => (
                    <li key={c.label} className="flex items-start gap-2 text-sm">
                        {c.ok ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />
                        ) : (
                            <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
                        )}
                        <span>
                            <span className="font-medium">{c.label}</span>
                            <span className="text-muted-foreground"> — {c.detail}</span>
                        </span>
                    </li>
                ))}
            </ul>

            <p className={cn('text-xs', preview.canConfirm ? 'text-muted-foreground' : 'text-destructive')}>
                {preview.canConfirm
                    ? 'Confirming marks this registration paid, confirms the seat and emails the payment confirmation and joining details to the participant.'
                    : 'This payment can’t be accepted for this registration.'}
            </p>
        </div>
    );
}
