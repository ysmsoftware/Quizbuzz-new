// lib/stores/maintenance-store.ts
import { create } from 'zustand';

// Backs the persistent top-of-screen maintenance banner. Set directly from
// apiClient.ts (a plain module, not a React component) via
// useMaintenanceStore.getState().setMaintenanceActive(...) whenever a
// MAINTENANCE_MODE response comes back, and read reactively by
// components/layout/MaintenanceBanner.tsx. Kept separate from the toast
// (maintenanceModeToast.ts) — the toast is a one-off, auto-dismissing
// notice; this store drives a banner that stays visible for as long as
// maintenance mode is actually active, across every page.
interface MaintenanceState {
  isActive: boolean;
  message: string | null;
  setMaintenanceActive: (active: boolean, message?: string) => void;
}

export const useMaintenanceStore = create<MaintenanceState>((set, get) => ({
  isActive: false,
  message: null,

  setMaintenanceActive: (active, message) => {
    const current = get();
    // Guard against redundant sets — apiClient calls this on every response,
    // successful or not, so avoid triggering a re-render when nothing changed.
    if (current.isActive === active && current.message === (message ?? null)) {
      return;
    }
    set({ isActive: active, message: active ? (message ?? current.message) : null });
  },
}));
