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
  createdAt: Date;
  updatedAt: Date;
}
