import { Organization, TeamMember, TeamInvitation, ApiResponse, TeamRole, InvitationStatus } from '@/lib/types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class OrganizationService {
  private organizations: Organization[] = [
    {
      id: 'org-001',
      name: 'QuizCraft Academy',
      slug: 'quizcraft-academy',
      description: 'Leading online assessment platform',
      website: 'https://quizcraft.io',
      industry: 'Education',
      logo: '/images/org-logo.png',
      primaryColor: '#3B82F6',
      secondaryColor: '#10B981',
      testMode: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  private teamMembers: TeamMember[] = [
    {
      id: 'tm-001',
      orgId: 'org-001',
      email: 'admin@quizcraft.io',
      name: 'Admin User',
      role: 'admin',
      status: 'active',
      joinedAt: new Date().toISOString(),
    },
  ];

  private teamInvitations: TeamInvitation[] = [];

  async getOrganization(orgId: string): Promise<ApiResponse<Organization>> {
    await delay(300);
    const org = this.organizations.find(o => o.id === orgId);
    return {
      success: !!org,
      data: org,
      message: org ? 'Organization found' : 'Organization not found',
    };
  }

  async updateOrganization(orgId: string, updates: Partial<Organization>): Promise<ApiResponse<Organization>> {
    await delay(500);
    const org = this.organizations.find(o => o.id === orgId);
    if (!org) {
      return { success: false, message: 'Organization not found' };
    }
    
    const updated = { ...org, ...updates, updatedAt: new Date().toISOString() };
    const index = this.organizations.indexOf(org);
    this.organizations[index] = updated;
    
    return {
      success: true,
      data: updated,
      message: 'Organization updated successfully',
    };
  }

  async getTeamMembers(orgId: string): Promise<ApiResponse<TeamMember[]>> {
    await delay(300);
    const members = this.teamMembers.filter(m => m.orgId === orgId);
    return {
      success: true,
      data: members,
    };
  }

  async getTeamInvitations(orgId: string): Promise<ApiResponse<TeamInvitation[]>> {
    await delay(300);
    const invitations = this.teamInvitations.filter(i => i.orgId === orgId && i.status === 'pending');
    return {
      success: true,
      data: invitations,
    };
  }

  async inviteTeamMember(orgId: string, email: string, role: TeamRole): Promise<ApiResponse<TeamInvitation>> {
    await delay(500);
    
    const exists = this.teamMembers.some(m => m.orgId === orgId && m.email === email);
    if (exists) {
      return { success: false, message: 'User is already a team member' };
    }

    const invitation: TeamInvitation = {
      id: `inv-${Date.now()}`,
      orgId,
      email,
      role,
      status: 'pending',
      sentAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    this.teamInvitations.push(invitation);

    return {
      success: true,
      data: invitation,
      message: 'Invitation sent successfully',
    };
  }

  async removeTeamMember(orgId: string, memberId: string): Promise<ApiResponse<{ removed: boolean }>> {
    await delay(500);
    
    const index = this.teamMembers.findIndex(m => m.id === memberId && m.orgId === orgId);
    if (index === -1) {
      return { success: false, message: 'Team member not found' };
    }

    this.teamMembers.splice(index, 1);

    return {
      success: true,
      data: { removed: true },
      message: 'Team member removed',
    };
  }

  async updateTeamMemberRole(orgId: string, memberId: string, role: TeamRole): Promise<ApiResponse<TeamMember>> {
    await delay(400);
    
    const member = this.teamMembers.find(m => m.id === memberId && m.orgId === orgId);
    if (!member) {
      return { success: false, message: 'Team member not found' };
    }

    member.role = role;

    return {
      success: true,
      data: member,
      message: 'Role updated successfully',
    };
  }

  async revokeInvitation(orgId: string, invitationId: string): Promise<ApiResponse<{ revoked: boolean }>> {
    await delay(400);
    
    const invitation = this.teamInvitations.find(i => i.id === invitationId && i.orgId === orgId);
    if (!invitation) {
      return { success: false, message: 'Invitation not found' };
    }

    invitation.status = 'revoked';

    return {
      success: true,
      data: { revoked: true },
      message: 'Invitation revoked',
    };
  }
}

export const organizationService = new OrganizationService();
