'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Mail, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import { MembersTable } from '@/components/features/organization/MembersTable';
import { InviteModal } from '@/components/features/organization/InviteModal';
import { TeamRole } from '@/lib/types';

export default function TeamPage() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.id || '';
  const [inviteOpen, setInviteOpen] = useState(false);
  const {
    members,
    invitations,
    loading,
    error,
    inviteMember,
    removeMember,
    updateMemberRole,
    revokeInvitation,
  } = useTeamMembers(orgId);

  const handleInvite = async (emails: string[], role: TeamRole) => {
    for (const email of emails) {
      const result = await inviteMember(email, role);
      if (!result) {
        toast.error(`Failed to invite ${email}`);
        return;
      }
    }
    toast.success(`Invitation${emails.length > 1 ? 's' : ''} sent successfully`);
  };

  const handleRemove = async (memberId: string) => {
    const success = await removeMember(memberId);
    if (success) {
      toast.success('Team member removed');
    } else {
      toast.error('Failed to remove team member');
    }
  };

  const handleUpdateRole = async (memberId: string, role: TeamRole) => {
    const result = await updateMemberRole(memberId, role);
    if (result) {
      toast.success('Role updated successfully');
    } else {
      toast.error('Failed to update role');
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    const success = await revokeInvitation(invitationId);
    if (success) {
      toast.success('Invitation revoked');
    } else {
      toast.error('Failed to revoke invitation');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Management</h1>
          <p className="text-muted-foreground">Manage team members and permissions</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Team Members Section */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {members.length} active member{members.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MembersTable
            members={members}
            onRemove={handleRemove}
            onUpdateRole={handleUpdateRole}
            isLoading={loading}
          />
        </CardContent>
      </Card>

      {/* Pending Invitations Section */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>
              {invitations.length} pending invite{invitations.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{invitation.email}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        Role: {invitation.role}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokeInvitation(invitation.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Modal */}
      <InviteModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvite={handleInvite}
      />
    </div>
  );
}
