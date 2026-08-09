'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useMaintenanceStore } from '@/lib/stores/maintenance-store';

// Fixed, high-contrast banner shown at the very top of every page while
// maintenance_mode is active — the toast (maintenanceModeToast.ts) fires
// once per blocked request and auto-dismisses; this stays visible for the
// whole outage so it's not missed on a page with no failed request yet.
export function MaintenanceBanner() {
    const isActive = useMaintenanceStore((state) => state.isActive);
    const message = useMaintenanceStore((state) => state.message);
    const [dismissed, setDismissed] = useState(false);

    // Re-arm the banner if maintenance mode toggles off and back on later —
    // a dismissal shouldn't silently suppress the next outage.
    useEffect(() => {
        if (isActive) {
            setDismissed(false);
        }
    }, [isActive]);

    if (!isActive || dismissed) {
        return null;
    }

    return (
        <div
            role="alert"
            className="sticky top-0 z-[100] flex items-center justify-center gap-3 border-b border-red-800 bg-red-600 px-4 py-3 text-white shadow-md"
        >
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="text-center text-sm font-medium sm:text-base">
                {message || 'The platform is temporarily under maintenance. Please try again shortly.'}
            </p>
            <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss maintenance notice"
                className="shrink-0 rounded p-1 opacity-80 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
                <X className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    );
}
