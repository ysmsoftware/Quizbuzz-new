// This store manages PARTICIPANT quiz session state only.
// Admin auth is handled by useAuth hook + server cookies.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  // Session data
  sessionToken: string | null;
  participantId: string | null;
  contestId: string | null;
  identifier: string | null; // phone or email used for OTP
  identifierType: 'phone' | 'email' | null;
  deviceId: string | null;

  // Computed
  isAuthenticated: boolean;

  // Actions
  setSession: (data: {
    sessionToken: string;
    participantId: string;
    contestId: string;
    identifier: string;
    identifierType: 'phone' | 'email';
    deviceId?: string;
  }) => void;

  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      sessionToken: null,
      participantId: null,
      contestId: null,
      identifier: null,
      identifierType: null,
      deviceId: null,
      isAuthenticated: false,

      // Actions
      setSession: (data) => {
        set({
          sessionToken: data.sessionToken,
          participantId: data.participantId,
          contestId: data.contestId,
          identifier: data.identifier,
          identifierType: data.identifierType,
          deviceId: data.deviceId || null,
          isAuthenticated: true,
        });
      },

      clearSession: () => {
        set({
          sessionToken: null,
          participantId: null,
          contestId: null,
          identifier: null,
          identifierType: null,
          deviceId: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'quizcraft-auth',
      storage: {
        getItem: (name) => {
          if (typeof window === 'undefined') return null;
          const str = sessionStorage.getItem(name);
          if (!str) return null;
          return JSON.parse(str);
        },
        setItem: (name, value) => {
          if (typeof window === 'undefined') return;
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          if (typeof window === 'undefined') return;
          sessionStorage.removeItem(name);
        },
      },
    }
  )
);
