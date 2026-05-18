'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import * as registrationApi from '../api/registration.api';

export type RegistrationStep = 'email' | 'otp' | 'form' | 'payment' | 'success';

/**
 * Public participant registration hook
 * 
 * Manages a multi-step registration flow:
 * 1. Email input → requestOtp
 * 2. OTP input → verifyOtp → get contactToken
 * 3. Registration form → registerForContest
 * 4. Payment (if needed)
 * 5. Success screen
 * 
 * The contactToken is stored only in component memory (useState),
 * never persisted to localStorage or sessionStorage.
 */
export function usePublicRegistration(contestSlug: string) {
  // Step tracking
  const [step, setStep] = useState<RegistrationStep>('email');

  // Form state
  const [email, setEmail] = useState('');
  const [contactToken, setContactToken] = useState<string | null>(null);

  // Registration result
  const [registrationResult, setRegistrationResult] = useState<any>(null);

  /**
   * Request OTP mutation
   */
  const requestOtpMutation = useMutation({
    mutationFn: () => registrationApi.requestOtp(email),
    onSuccess: () => {
      setStep('otp');
    },
  });

  /**
   * Verify OTP mutation
   */
  const verifyOtpMutation = useMutation({
    mutationFn: ({ otp }: { otp: string }) => registrationApi.verifyOtp(email, otp),
    onSuccess: (data: any) => {
      setContactToken(data.data.contactToken);
      setStep('form');
    },
  });

  /**
   * Register for contest mutation
   */
  const registerMutation = useMutation({
    mutationFn: (formBody: any) =>
      registrationApi.registerForContest(contestSlug, {
        ...formBody,
        contactToken,
      }),
    onSuccess: (data: any) => {
      setRegistrationResult(data.data);
      if (data.data.paymentRequired) {
        setStep('payment');
      } else {
        setStep('success');
      }
    },
  });

  return {
    // Step management
    step,
    setStep,

    // Form state
    email,
    setEmail,
    contactToken,

    // Registration result
    registrationResult,

    // Mutations
    requestOtpMutation,
    verifyOtpMutation,
    registerMutation,
  };
}
