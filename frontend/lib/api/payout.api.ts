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

export async function getPayoutAccount(): Promise<ApiResponse<any>> {
  return get('/payout-accounts/account');
}

export async function setupPayoutAccount(payload: SetupPayoutAccountPayload): Promise<ApiResponse<any>> {
  return post('/payout-accounts/setup', payload);
}

export async function attachLinkedAccount(payload: AttachLinkedAccountPayload): Promise<ApiResponse<any>> {
  return patch('/payout-accounts/link', payload);
}

export async function listPayoutTransfers(): Promise<ApiResponse<any[]>> {
  return get('/payout-accounts/transfers');
}
