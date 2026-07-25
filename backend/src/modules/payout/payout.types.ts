import { PayoutAccountStatus, PayoutOnboardingMode, RouteTransferStatus } from "@prisma/client";

export interface SetupPayoutAccountInput {
  accountName: string;
  accountEmail: string;
  contactNumber?: string | undefined;
}

export interface AttachLinkedAccountInput {
  razorpayLinkedAccountId: string;
}

export interface PayoutAccountResponse {
  id: string;
  organizationId: string;
  razorpayLinkedAccountId: string | null;
  accountName: string;
  accountEmail: string;
  contactNumber: string | null;
  status: PayoutAccountStatus;
  onboardingMode: PayoutOnboardingMode;
  activatedAt: Date | null;
  statusReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayoutTransferItem {
  id: string;
  contestTitle: string;
  grossAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  gatewayFeePercent: number;
  gatewayFeeAmount: number;
  gstPercent: number;
  gstAmount: number;
  totalDeducted: number;
  transferAmount: number;
  currency: string;
  status: RouteTransferStatus;
  failureReason: string | null;
  razorpayTransferId: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface PayoutTransferSummary {
  processed: number;
  pending: number;
  failed: number;
  totalReceivedAllTime: number;
  currency: string;
}

