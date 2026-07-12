// lib/stores/pwa-store.ts
import { create } from 'zustand';

interface PwaState {
  // Stores the browser's native beforeinstallprompt event (Chrome, Edge, Android)
  deferredPrompt: any | null;
  // Controls custom installation UI prompt visibility
  showInstallPrompt: boolean;
  // Flag tracking if the app is already running in standalone mode
  isStandalone: boolean;
  // Actions
  setDeferredPrompt: (event: any | null) => void;
  setShowInstallPrompt: (show: boolean) => void;
  setIsStandalone: (isStandalone: boolean) => void;
  triggerInstall: () => Promise<boolean>;
}

export const usePwaStore = create<PwaState>((set, get) => ({
  deferredPrompt: null,
  showInstallPrompt: false,
  isStandalone: false,

  setDeferredPrompt: (event) => {
    set({ deferredPrompt: event });
  },

  setShowInstallPrompt: (show) => {
    set({ showInstallPrompt: show });
  },

  setIsStandalone: (isStandalone) => {
    set({ isStandalone });
  },

  triggerInstall: async () => {
    const { deferredPrompt } = get();
    if (!deferredPrompt) {
      return false;
    }

    try {
      // Trigger native prompt
      deferredPrompt.prompt();

      // Wait for user choice
      const { outcome } = await deferredPrompt.userChoice;
      
      // Clear deferred prompt event as it can only be used once
      set({ deferredPrompt: null, showInstallPrompt: false });
      
      return outcome === 'accepted';
    } catch (error) {
      console.error('Failed to trigger PWA installation prompt:', error);
      set({ deferredPrompt: null, showInstallPrompt: false });
      return false;
    }
  },
}));
