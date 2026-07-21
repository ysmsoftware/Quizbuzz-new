'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as payoutApi from '../api/payout.api';
import { queryKeys } from '../api/queryClient';

export function usePayout() {
  const queryClient = useQueryClient();

  const accountQuery = useQuery({
    queryKey: queryKeys.payout.account,
    queryFn: () => payoutApi.getPayoutAccount(),
  });

  const transfersQuery = useQuery({
    queryKey: queryKeys.payout.transfers,
    queryFn: () => payoutApi.listPayoutTransfers(),
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
    setupAccountMutation,
    attachLinkedAccountMutation,

    account: accountData?.account ?? null,
    status,
    isActive,
    hasAccount,
    loading: accountQuery.isLoading,
    error: accountQuery.error?.message ?? null,
  };
}
