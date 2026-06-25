'use client';

import { useState, useCallback, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as paymentApi from '../api/payment.api';
import { queryKeys } from '../api/queryClient';
import { registrationService } from '../services/registration-service';
import type { RazorpayOrderResult } from '../services/registration-service';

export type PaymentFlowState =
    | "idle"
    | "creating_order"
    | "checkout_open"
    | "verifying"
    | "polling"
    | "success"
    | "failed"
    | "cancelled"
    | "timeout";

export interface RazorpayConfig {
    amount: number;
    currency: string;
    eventTitle: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    callbackQueryParams?: Record<string, string>;
}

export interface UseRazorpayReturn {
    state: PaymentFlowState;
    error: string | null;
    initiatePayment: (contestId: string, participantId: string, config: RazorpayConfig) => Promise<void>;
    retryPayment: (participantId: string, config: RazorpayConfig) => Promise<void>;
    openCheckout: (config: RazorpayConfig, orderData: RazorpayOrderResult, participantId: string) => Promise<void>;
    loadRazorpay: () => Promise<boolean>;
}

// ── Guaranteed lazy script loader ────────────────────────────────────────
// Resolves immediately if already loaded, injects + waits if not.
// Safe to call multiple times — idempotent.
function loadRazorpayScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined") {
            reject(new Error("Not in browser"));
            return;
        }
        // Already loaded
        if ((window as any).Razorpay) {
            resolve();
            return;
        }
        // Script tag exists but hasn't fired onload yet
        const existingScript = document.querySelector(
            'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
        ) as HTMLScriptElement | null;
        if (existingScript) {
            existingScript.addEventListener("load", () => resolve());
            existingScript.addEventListener("error", () =>
                reject(new Error("Razorpay script failed to load. Check your connection."))
            );
            return;
        }
        // Inject fresh script
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () =>
            reject(new Error("Failed to load Razorpay. Check your internet connection and try again."));
        document.head.appendChild(script);
    });
}

// ── Polling helper ────────────────────────────────────────────────────────
function pollPaymentStatus(
    participantId: string,
    onSuccess: () => void,
    onFailed: (reason: string) => void,
    onTimeout: () => void,
    maxAttempts = 36, // 90 seconds total at 2.5s interval
    intervalMs = 2500
): () => void {
    let attempts = 0;
    const id = setInterval(async () => {
        attempts++;
        try {
            const result = await registrationService.checkPaymentStatus(participantId);
            const status = result.status;
            if (status === "SUCCESS") { clearInterval(id); onSuccess(); return; }
            if (status === "FAILED" || status === "CANCELLED") { clearInterval(id); onFailed(result.failureReason || "Payment failed"); return; }
            if (attempts >= maxAttempts) { clearInterval(id); onTimeout(); return; }
        } catch {
            if (attempts >= maxAttempts) { clearInterval(id); onTimeout(); }
        }
    }, intervalMs);
    // Return cleanup function
    return () => clearInterval(id);
}

export function useRazorpay(): UseRazorpayReturn {
    const [state, setState] = useState<PaymentFlowState>("idle");
    const [error, setError] = useState<string | null>(null);
    const checkoutOpenRef = useRef(false);
    const stopPollingRef = useRef<(() => void) | null>(null);

    const openCheckout = useCallback(async (
        config: RazorpayConfig,
        orderData: RazorpayOrderResult,
        participantId: string
    ) => {
        // Load Razorpay script — guaranteed before opening modal
        try {
            await loadRazorpayScript();
        } catch (err: any) {
            setState("failed");
            setError(err.message);
            checkoutOpenRef.current = false;
            return;
        }

        setState("checkout_open");

        const callbackUrl = new URL("/payment/callback", window.location.origin);
        callbackUrl.searchParams.set("participantId", participantId);
        callbackUrl.searchParams.set("returnUrl", window.location.href);
        if (config.callbackQueryParams) {
            Object.entries(config.callbackQueryParams).forEach(([key, value]) => {
                callbackUrl.searchParams.set(key, value);
            });
        }

        const options = {
            key: orderData.keyId,
            amount: orderData.amount,
            currency: orderData.currency,
            name: "QuizBuzz",
            description: config.eventTitle,
            order_id: orderData.orderId,

            // ── Mobile UPI redirect support ────────────────────
            // When Razorpay can't return control to the JS handler
            // (e.g. after UPI app completes payment on mobile),
            // it redirects the browser here instead.
            callback_url: callbackUrl.toString(),
            redirect: false,  // keep modal on desktop, allow redirect on mobile as fallback
            // ───────────────────────────────────────────────────

            prefill: {
                name: config.contactName ?? "",
                email: config.contactEmail ?? "",
                contact: config.contactPhone ?? "",
            },
            theme: { color: "#6366f1" },
            modal: {
                ondismiss: () => {
                    checkoutOpenRef.current = false;
                    setState("polling");
                    stopPollingRef.current = pollPaymentStatus(
                        participantId,
                        () => setState("success"),
                        (reason) => { setState("failed"); setError(reason || "Payment failed. Please try again."); },
                        () => setState("timeout")
                    );
                },
            },
            handler: async (response: {
                razorpay_order_id: string;
                razorpay_payment_id: string;
                razorpay_signature: string;
            }) => {
                checkoutOpenRef.current = false;
                setState("verifying");
                try {
                    await paymentApi.verifyPayment({
                        razorpayOrderId: response.razorpay_order_id,
                        razorpayPaymentId: response.razorpay_payment_id,
                        razorpaySignature: response.razorpay_signature,
                        participantId: participantId,
                    });
                } catch {
                    // Verification network error — still poll, webhook may confirm
                }
                setState("polling");
                stopPollingRef.current = pollPaymentStatus(
                    participantId,
                    () => setState("success"),
                    (reason) => { setState("failed"); setError(reason || "Payment failed. Please try again."); },
                    () => setState("success") // timeout = still show success, webhook will confirm
                );
            },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", () => {
            // Wait for ondismiss to trigger polling, or we could trigger it here.
            // ondismiss will trigger anyway, but let's just make sure.
        });
        rzp.open();
    }, []);

    const initiatePayment = useCallback(async (
        contestId: string,
        participantId: string,
        config: RazorpayConfig
    ) => {
        if (checkoutOpenRef.current) return;
        checkoutOpenRef.current = true;
        setError(null);
        setState("creating_order");
        try {
            const orderData = await registrationService.createPaymentOrder(contestId, participantId);
            await openCheckout(config, orderData, participantId);
        } catch (err: any) {
            checkoutOpenRef.current = false;
            setState("failed");
            setError(err.message ?? "Failed to initiate payment. Please try again.");
        }
    }, [openCheckout]);

    const retryPayment = useCallback(async (
        participantId: string,
        config: RazorpayConfig
    ) => {
        if (checkoutOpenRef.current) return;
        checkoutOpenRef.current = true;
        setError(null);
        setState("creating_order");
        try {
            const res = await paymentApi.retryPayment(participantId, `retry-${participantId}-${Date.now()}`);
            const orderData = res.data as RazorpayOrderResult;
            await openCheckout(config, orderData, participantId);
        } catch (err: any) {
            checkoutOpenRef.current = false;
            setState("failed");
            setError(err.message ?? "Failed to retry payment.");
        }
    }, [openCheckout]);

    const loadRazorpay = useCallback(async () => {
        try {
            await loadRazorpayScript();
            return true;
        } catch {
            return false;
        }
    }, []);

    return { state, error, initiatePayment, retryPayment, openCheckout, loadRazorpay };
}

/**
 * Hook for payment status and operations (Legacy/Simple hook)
 */
export function usePayment(participantId?: string) {
  const statusQuery = useQuery({
    queryKey: queryKeys.payments.status(participantId || ''),
    queryFn: () => paymentApi.getPaymentStatus(participantId!),
    enabled: !!participantId,
  });

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
      }, razorpayOrderId),
  });

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
