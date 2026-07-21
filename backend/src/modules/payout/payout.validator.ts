import { z } from "zod";

export const setupPayoutAccountSchema = z.object({
  accountName: z.string().min(2, "Account name must be at least 2 characters"),
  accountEmail: z.string().email("Invalid email address"),
  contactNumber: z.string().optional(),
});

export const attachLinkedAccountSchema = z.object({
  razorpayLinkedAccountId: z.string().regex(/^acc_[a-zA-Z0-9]+$/, "Must be a valid Razorpay linked account ID starting with acc_"),
});
