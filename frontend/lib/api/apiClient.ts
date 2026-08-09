/**
 * Central API client with auto-refresh loop and standardized error handling.
 * Following Rule 17: Standard Error Reference & Frontend HTTP Client.
 */

import { notifyPlanLimitExceeded } from '../notifications/planLimitToast';
import { notifyFeatureUnavailable } from '../notifications/featureUnavailableToast';
import { notifyMaintenanceMode } from '../notifications/maintenanceModeToast';
import { useMaintenanceStore } from '../stores/maintenance-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

const PLAN_LIMIT_EXCEEDED_CODE = 'PLAN_LIMIT_EXCEEDED';
const FEATURE_DISABLED_CODE = 'FEATURE_DISABLED';
const MAINTENANCE_MODE_CODE = 'MAINTENANCE_MODE';

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  requestId?: string;
}

export interface ApiError {
  success: false;
  code: string;
  message: string;
  details?: Record<string, string[]>;
  requestId?: string;
  // Only present when code === "PLAN_LIMIT_EXCEEDED" — see backend's
  // PlanLimitExceededError / error.middleware.ts.
  limitType?: string;
  limit?: number;
  current?: number;
  // Only present when code === "FEATURE_DISABLED" — see backend's
  // FeatureUnavailableError / error.middleware.ts.
  featureKey?: string;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>,
    public readonly requestId?: string,
    public readonly status?: number,
    public readonly limitType?: string,
    public readonly limit?: number,
    public readonly current?: number,
    public readonly featureKey?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export interface ApiOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipContentType?: boolean;
}

let isRefreshing = false;
let refreshQueue: Array<() => void> = [];

async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/admin/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Core fetch wrapper
 */
export async function apiClient<T = unknown>(
  path: string,
  options: ApiOptions = {},
  retry = true
): Promise<ApiResponse<T>> {
  const { skipContentType, params, ...init } = options;

  let url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const headers = new Headers(init.headers || {});
  if (!skipContentType && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const fetchOptions: RequestInit = {
    ...init,
    credentials: 'include',
    headers,
  };

  const res = await fetch(url, fetchOptions);

  // Handle 401 — try to refresh once (never on login/register — those return real error messages)
  const isAuthAttempt =
    path.includes('/auth/admin/login') ||
    path.includes('/auth/admin/register') ||
    path.includes('/auth/admin/forgot-password') ||
    path.includes('/auth/admin/logout') ||
    path.includes('/auth/admin/logout-all');

  if (res.status === 401 && retry && !isAuthAttempt) {
    if (isRefreshing) {
      // Wait for the ongoing refresh to complete
      await new Promise<void>((resolve) => refreshQueue.push(resolve));
      return apiClient<T>(path, options, false);
    }

    isRefreshing = true;
    const success = await refreshToken();
    isRefreshing = false;

    // Resume all queued requests
    const currentQueue = [...refreshQueue];
    refreshQueue = [];
    currentQueue.forEach((resolve) => resolve());

    if (success) {
      return apiClient<T>(path, options, false);
    } else {
      if (typeof window !== 'undefined') {
        const authPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
        const isOnAuthPage = authPaths.some((p) => window.location.pathname.startsWith(p));
        if (!isOnAuthPage) {
          window.location.replace('/login');
        }
      }
      throw new ApiRequestError("UNAUTHORIZED", "Session expired. Please log in again.", undefined, undefined, 401);
    }
  }

  const data = await res.json() as ApiResponse<T> | ApiError;

  if (!data.success) {
    const errData = data as ApiError;

    // Fires for every caller automatically — no per-call-site handling
    // needed to turn a blocked request into a visible "upgrade your plan"
    // toast instead of a silent failure or a raw error in the console.
    if (errData.code === PLAN_LIMIT_EXCEEDED_CODE) {
      notifyPlanLimitExceeded(errData);
    }

    // Same automatic, no-per-call-site-effort treatment as PLAN_LIMIT_EXCEEDED
    // above — a feature turning off must never be a silent no-op.
    if (errData.code === FEATURE_DISABLED_CODE) {
      notifyFeatureUnavailable(errData);
    }

    // maintenance.middleware.ts gates every /api/v1 request, including plain
    // GET page loads that don't have their own onError toast — without this,
    // those requests would fail with no visible message to the end user.
    // Also drives the persistent top-of-screen banner (MaintenanceBanner.tsx),
    // not just the one-off toast, since maintenance can outlast any single
    // request's toast duration.
    if (errData.code === MAINTENANCE_MODE_CODE) {
      notifyMaintenanceMode(errData);
      useMaintenanceStore.getState().setMaintenanceActive(true, errData.message);
    } else {
      // Any other response — success or a different error — means this
      // request got past maintenanceGate, so maintenance mode is not (or no
      // longer) active. Clears a stale banner left over from an earlier
      // outage without needing a separate poll.
      useMaintenanceStore.getState().setMaintenanceActive(false);
    }

    throw new ApiRequestError(
      errData.code ?? "UNKNOWN_ERROR",
      errData.message ?? res.statusText,
      errData.details,
      errData.requestId,
      res.status,
      errData.limitType,
      errData.limit,
      errData.current,
      errData.featureKey,
    );
  }

  // A successful response also means maintenanceGate let this request
  // through — clear the banner if it was showing.
  useMaintenanceStore.getState().setMaintenanceActive(false);

  return data as ApiResponse<T>;
}

/**
 * Convenience wrappers
 */
export const get = <T = unknown>(path: string, options?: ApiOptions) =>
  apiClient<T>(path, { ...options, method: 'GET' });

export const post = <T = unknown>(path: string, body?: unknown, options?: ApiOptions) =>
  apiClient<T>(path, {
    ...options,
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

export const patch = <T = unknown>(path: string, body?: unknown, options?: ApiOptions) =>
  apiClient<T>(path, {
    ...options,
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

export const del = <T = unknown>(path: string, options?: ApiOptions) =>
  apiClient<T>(path, { ...options, method: 'DELETE' });

export const postIdempotent = <T = unknown>(path: string, body?: unknown, idempotencyKey?: string, options?: ApiOptions) =>
  apiClient<T>(path, {
    ...options,
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      ...(options?.headers || {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    }
  });
