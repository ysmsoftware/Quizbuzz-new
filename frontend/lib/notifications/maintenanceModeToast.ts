import { toast } from 'sonner';

/**
 * Single responsibility: turn a MAINTENANCE_MODE API error into a visible
 * toast, mirroring featureUnavailableToast.ts's FEATURE_DISABLED handling —
 * same "one place decides what the user sees for this error code" reasoning.
 *
 * Why this exists as its own module instead of just reusing
 * notifyFeatureUnavailable: maintenance mode blocks every /api/v1 request at
 * once (maintenance.middleware.ts gates the whole router), so a page that
 * fires several parallel requests would otherwise stack several identical
 * toasts. A fixed toast id makes repeated calls update the same toast
 * in place instead of piling up.
 */

export interface MaintenanceModeToastInput {
  message: string;
}

const MAINTENANCE_TOAST_ID = 'maintenance-mode';

export function notifyMaintenanceMode(input: MaintenanceModeToastInput): void {
  toast.error(input.message || 'The platform is temporarily under maintenance.', {
    id: MAINTENANCE_TOAST_ID,
    description: 'Please try again shortly.',
    duration: 8000,
  });
}
