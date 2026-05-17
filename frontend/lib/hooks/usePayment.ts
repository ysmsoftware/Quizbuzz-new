'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import * as paymentApi from '../api/payment.api';
import { queryKeys } from '../api/queryClient';

/**
 * Hook for payment status and operations
 */
export function usePayment(participantId?: string) {
  /**
   * Check payment status
   */
  const statusQuery = useQuery({
    queryKey: queryKeys.payments.status(participantId || ''),
    queryFn: () => paymentApi.getPaymentStatus(participantId!),
    enabled: !!participantId,
  });

  /**
   * Verify payment mutation
   */
  const verifyMutation = useMutation({
    mutationFn: ({ 
      razorpayOrderId, 
      razorpayPaymentId, 
      razorpaySignature 
    }: { 
      razorpayOrderId: string; 
      razorpayPaymentId: string; 
      razorpaySignature: string; 
    }) => 
      paymentApi.verifyPayment({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        participantId: participantId!,
      }, razorpayOrderId), // Use orderId as idempotency key
  });

  /**
   * Retry payment mutation
   */
  const retryMutation = useMutation({
    mutationFn: () => 
      paymentApi.retryPayment(participantId!, `retry-${participantId}-${Date.now()}`),
  });

  return {
    statusQuery,
    verifyMutation,
    retryMutation,
    status: statusQuery.data?.data,
    isLoading: statusQuery.isLoading,
  };
}

/**
 * Hook for loading Razorpay SDK
 */
export function useRazorpay() {
  const loadRazorpay = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  return { loadRazorpay };
}
