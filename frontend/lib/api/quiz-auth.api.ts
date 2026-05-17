import { post, get } from './apiClient';
import { ApiResponse } from '../types';

export interface QuizAuthResponse {
  participantId: string;
  contestId: string;
  firstName: string;
  joinCodeRequired: boolean;
  contestStatus: string;
  startTime: string;
  message: string;
}

export interface SessionTokenResponse {
  sessionToken: string;
  expiresIn: number;
}

export interface SocketTokenResponse {
  socketToken: string;
  expiresIn: number;
  participantId: string;
  contestId: string;
  inWaitingRoom: boolean;
  contestStartTime: string;
  resumeFromQuestion: number | null;
}

export interface SessionStatusResponse {
  isAuthenticated: boolean;
  hasActiveSession: boolean;
  socketToken?: string;
  resumeFromQuestion?: number;
  inWaitingRoom?: boolean;
}

/**
 * Step 1: Verify identity (email + registration reference)
 */
export const authenticate = (email: string, registrationRef: string, contestSlug: string) =>
  post<QuizAuthResponse>('/auth/quiz/authenticate', { email, registrationRef, contestSlug });

/**
 * Step 2a: Verify join code (if required)
 */
export const verifyJoinCode = (participantId: string, contestId: string, joinCode: string) =>
  post<SessionTokenResponse>('/auth/quiz/verify-join-code', { participantId, contestId, joinCode });

/**
 * Step 2b: Request OTP (if join code not used)
 */
export const requestOtp = (email: string) =>
  post<{ message: string }>('/auth/quiz/request-otp', { email });

/**
 * Step 2c: Verify OTP
 */
export const verifyOtp = (email: string, otp: string, participantId: string) =>
  post<SessionTokenResponse>('/auth/quiz/verify-otp', { email, otp, participantId });

/**
 * Step 3: Exchange session token for socket token
 */
export const createSession = (sessionToken: string, participantId: string, deviceFingerprint?: string) =>
  post<SocketTokenResponse>('/auth/quiz/create-session', { sessionToken, participantId, deviceFingerprint });

/**
 * Check if participant already has an active session
 */
export const getSessionStatus = (participantId: string) =>
  get<SessionStatusResponse>(`/auth/quiz/session-status/${participantId}`);
