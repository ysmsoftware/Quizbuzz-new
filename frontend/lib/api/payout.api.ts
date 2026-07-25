import { get, patch, post } from './apiClient';
import type { ApiResponse } from './apiClient';

export interface SetupPayoutAccountPayload {
  accountName: string;
  accountEmail: string;
  contactNumber?: string;
}

export interface AttachLinkedAccountPayload {
  razorpayLinkedAccountId: string;
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
  status: 'PENDING' | 'PROCESSED' | 'FAILED' | 'REVERSED';
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

export interface PaginatedTransfersResponse {
  items: PayoutTransferItem[];
  total: number;
  page: number;
  limit: number;
}

export async function getPayoutAccount(): Promise<ApiResponse<any>> {
  return get('/payout-accounts/account');
}

export async function setupPayoutAccount(payload: SetupPayoutAccountPayload): Promise<ApiResponse<any>> {
  return post('/payout-accounts/setup', payload);
}

export async function attachLinkedAccount(payload: AttachLinkedAccountPayload): Promise<ApiResponse<any>> {
  return patch('/payout-accounts/link', payload);
}

export async function listPayoutTransfers(params: {
  page: number;
  limit: number;
  status: string;
}): Promise<ApiResponse<PaginatedTransfersResponse>> {
  return get(`/payout-accounts/transfers?page=${params.page}&limit=${params.limit}&status=${params.status}`);
}

export async function getPayoutSummary(): Promise<ApiResponse<PayoutTransferSummary>> {
  return get('/payout-accounts/summary');
}

