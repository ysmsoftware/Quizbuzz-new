import { z } from "zod";

export const createOrderSchema = z.object({
    contestId: z.string().min(1),
    participantId: z.string().min(1),
});

export const verifyPaymentSchema = z.object({
    razorpayPaymentId: z.string().min(1),
    razorpayOrderId: z.string().min(1),
    razorpaySignature: z.string().min(1),
});

export const retryPaymentSchema = z.object({
    participantId: z.string().min(1),
    contestId: z.string().min(1),
});

export const verifyRazorpayReferenceSchema = z.object({
    // A Razorpay payment ID (pay_…) or order ID (order_…).
    reference: z.string().trim().regex(/^(pay|order)_[A-Za-z0-9]+$/, "Enter a Razorpay payment ID (pay_…) or order ID (order_…)"),
});

export const listPaymentsSchema = z.object({
    contestId: z.string().min(1).optional(),
    contactId: z.string().min(1).optional(),
    razorpayPaymentId: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    status: z.enum(["PENDING", "SUCCESS", "FAILED", "CANCELLED"]).optional(),
});
