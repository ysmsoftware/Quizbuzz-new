'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as payoutApi from '../api/payout.api';
import { queryKeys } from '../api/queryClient';

export interface UsePayoutParams {
  page?: number;
  limit?: number;
  status?: string;
}

export function usePayout(params: UsePayoutParams = {}) {
  const queryClient = useQueryClient();
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const statusParam = params.status ?? 'all';

  const accountQuery = useQuery({
    queryKey: queryKeys.payout.account,
    queryFn: () => payoutApi.getPayoutAccount(),
  });

  const transfersQuery = useQuery({
    queryKey: queryKeys.payout.transfers({ page, limit, status: statusParam }),
    queryFn: () => payoutApi.listPayoutTransfers({ page, limit, status: statusParam }),
  });

  const summaryQuery = useQuery({
    queryKey: queryKeys.payout.summary,
    queryFn: () => payoutApi.getPayoutSummary(),
  });

  const setupAccountMutation = useMutation({
    mutationFn: (payload: payoutApi.SetupPayoutAccountPayload) =>
      payoutApi.setupPayoutAccount(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payout.account });
    },
  });

  const attachLinkedAccountMutation = useMutation({
    mutationFn: (payload: payoutApi.AttachLinkedAccountPayload) =>
      payoutApi.attachLinkedAccount(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payout.account });
    },
  });

  const accountData = accountQuery.data?.data;
  const status = accountData?.status ?? 'PENDING';
  const isActive = status === 'ACTIVE';
  const hasAccount = !!accountData?.hasAccount;

  return {
    accountQuery,
    transfersQuery,
    summaryQuery,
    setupAccountMutation,
    attachLinkedAccountMutation,

    account: accountData?.account ?? null,
    status,
    isActive,
    hasAccount,
    loading: accountQuery.isLoading,
    error: accountQuery.error?.message ?? null,

    transfers: transfersQuery.data?.data?.items ?? [],
    transfersTotal: transfersQuery.data?.data?.total ?? 0,
    summary: summaryQuery.data?.data ?? null,
  };
}

