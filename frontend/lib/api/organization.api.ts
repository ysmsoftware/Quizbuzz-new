/**
 * Organization Management API Functions
 * 
 * Maps directly to 02-organization.md endpoints.
 * Base path: /org
 */

import { del, get, patch, post } from './apiClient';
import type { ApiResponse } from './apiClient';
import type { TeamRole } from '../types';

/**
 * GET /org/:orgId
 */
export async function getOrg(orgId: string): Promise<ApiResponse> {
  return get(`/org/${orgId}`);
}

/**
 * PATCH /org/:orgId
 */
export async function updateOrg(
  orgId: string,
  body: {
    name?: string;
    logoUrl?: string;
    website?: string;
  }
): Promise<ApiResponse> {
  return patch(`/org/${orgId}`, body);
}

/**
 * GET /org/:orgId/members
 */
export async function getOrgMembers(orgId: string): Promise<ApiResponse<any[]>> {
  return get<any[]>(`/org/${orgId}/members`);
}

/**
 * POST /org/:orgId/members/invite
 */
export async function inviteMember(
  orgId: string,
  body: {
    email: string;
    role: TeamRole;
  }
): Promise<ApiResponse> {
  return post(`/org/${orgId}/members/invite`, body);
}

/**
 * PATCH /org/:orgId/members/:memberId/role
 */
export async function changeMemberRole(
  orgId: string,
  memberId: string,
  role: TeamRole
): Promise<ApiResponse> {
  return patch(`/org/${orgId}/members/${memberId}/role`, { role });
}

/**
 * DELETE /org/:orgId/members/:memberId
 */
export async function removeMember(orgId: string, memberId: string): Promise<ApiResponse> {
  return del(`/org/${orgId}/members/${memberId}`);
}

/**
 * POST /org/invite/accept
 * Public endpoint — accepts org invite token from email
 */
export async function acceptInvite(token: string): Promise<ApiResponse> {
  return post('/org/invite/accept', { token });
}
