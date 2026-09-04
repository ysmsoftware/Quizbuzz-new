/**
 * Platform-wide settings — currently just the app logo, managed remotely
 * from the ops dashboard. Public endpoint, no auth.
 */

import { get } from './apiClient';
import type { ApiResponse } from './apiClient';

export interface PlatformAppLogo {
  appLogoUrl: string | null;
}

/**
 * GET /platform/app-logo
 */
export async function getAppLogo(): Promise<ApiResponse<PlatformAppLogo>> {
  return get('/platform/app-logo');
}
