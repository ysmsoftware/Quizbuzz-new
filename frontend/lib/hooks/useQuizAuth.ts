'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import * as quizAuthApi from '../api/quiz-auth.api';
import { useState, useCallback } from 'react';

export type AuthStep = 'identity' | 'verification' | 'ready';

/**
 * Hook for managing the multi-step quiz authentication flow
 */
export function useQuizAuth(contestSlug: string) {
  const [step, setStep] = useState<AuthStep>('identity');
  const [authData, setAuthData] = useState<quizAuthApi.QuizAuthResponse | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [socketToken, setSocketToken] = useState<string | null>(null);

  /**
   * Step 1: Authenticate with email and registration reference
   */
  const authenticateMutation = useMutation({
    mutationFn: ({ email, registrationRef }: { email: string, registrationRef: string }) =>
      quizAuthApi.authenticate(email, registrationRef, contestSlug),
    onSuccess: (res) => {
      setAuthData(res.data as any);
      setStep('verification');
    },
  });

  /**
   * Step 2a: Verify Join Code
   */
  const verifyJoinCodeMutation = useMutation({
    mutationFn: (joinCode: string) =>
      quizAuthApi.verifyJoinCode(authData!.participantId, authData!.contestId, joinCode),
    onSuccess: (res) => {
      setSessionToken(res.data?.sessionToken || null);
    },
  });

  /**
   * Step 2b: Request OTP
   */
  const requestOtpMutation = useMutation({
    mutationFn: (email: string) => quizAuthApi.requestOtp(email),
  });

  /**
   * Step 2c: Verify OTP
   */
  const verifyOtpMutation = useMutation({
    mutationFn: ({ email, otp }: { email: string, otp: string }) =>
      quizAuthApi.verifyOtp(email, otp, authData!.participantId),
    onSuccess: (res) => {
      setSessionToken(res.data?.sessionToken || null);
    },
  });

  /**
   * Step 3: Create Socket Session
   */
  const createSessionMutation = useMutation({
    mutationFn: () =>
      quizAuthApi.createSession(sessionToken!, authData!.participantId),
    onSuccess: (res) => {
      const token = res.data?.socketToken || null;
      setSocketToken(token);
      if (token) {
        sessionStorage.setItem(`socket_token_${authData?.contestId}`, token);
      }
      setStep('ready');
    },
  });

  /**
   * Check for existing session
   */
  const useSessionStatus = (participantId: string) => useQuery({
    queryKey: ['quiz-session-status', participantId],
    queryFn: () => quizAuthApi.getSessionStatus(participantId),
    enabled: !!participantId,
  });

  return {
    step,
    setStep,
    authData,
    sessionToken,
    socketToken,
    authenticate: authenticateMutation,
    verifyJoinCode: verifyJoinCodeMutation,
    requestOtp: requestOtpMutation,
    verifyOtp: verifyOtpMutation,
    createSession: createSessionMutation,
    useSessionStatus,
  };
}
