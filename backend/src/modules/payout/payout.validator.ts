import { z } from "zod";
import { config } from "../../config";

export const setupPayoutAccountSchema = z.object({
  accountName: z.string().min(2, "Account name must be at least 2 characters"),
  accountEmail: z.string().email("Invalid email address"),
  contactNumber: z.string().optional(),
});

export const attachLinkedAccountSchema = z.object({
  razorpayLinkedAccountId: z.string().regex(/^acc_[a-zA-Z0-9]+$/, "Must be a valid Razorpay linked account ID starting with acc_"),
});

export const listTransfersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(config.payout.maxPageSize).default(20),
  status: z.enum(['all', 'PENDING', 'PROCESSED', 'FAILED', 'REVERSED']).default('all'),
});

