'use client';

import { useState } from 'react';
import { Trash2, Shield, Edit2, Check, X, Crown, Eye, UserCheck, Clock, AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { TeamMember, TeamRole } from '@/lib/types';
import { toast } from 'sonner';

interface MembersTableProps {
  members: TeamMember[];
  currentAdminId?: string;
  isOwner?: boolean;
  onRemove: (memberId: string) => Promise<void>;
  onUpdateRole: (memberId: string, role: TeamRole) => Promise<void>;
  isLoading?: boolean;
}

export function MembersTable({
  members,
  currentAdminId,
  isOwner = true,
  onRemove,
  onUpdateRole,
  isLoading = false,
}: MembersTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<TeamRole>('ADMIN');
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const normalizedRole = (role: string): 'OWNER' | 'ADMIN' | 'VIEWER' => {
    const r = role.toUpperCase();
    if (r === 'OWNER') return 'OWNER';
    if (r === 'VIEWER') return 'VIEWER';
    return 'ADMIN';
  };

  const handleEditRole = (member: TeamMember) => {
    setEditingId(member.id);
    setSelectedRole(normalizedRole(member.role));
  };

  const handleSaveRole = async (memberId: string) => {
    try {
      await onUpdateRole(memberId, selectedRole);
      toast.success('Member role updated successfully');
      setEditingId(null);
    } catch (err: any) {
      console.error('Update role error:', err);
      toast.error(err?.message || 'Failed to update member role');
    }
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    setIsRemoving(true);
    try {
      await onRemove(memberToRemove.id);
      toast.success('Member removed from organization');
      setMemberToRemove(null);
    } catch (err: any) {
      console.error('Remove member error:', err);
      toast.error(err?.message || 'Failed to remove member');
    } finally {
      setIsRemoving(false);
    }
  };

  const activeOwnersCount = members.filter(
    (m) => normalizedRole(m.role) === 'OWNER' && (m.isActive ?? true)
  ).length;

  return (
    <>
      <div className="rounded-md border border-border/60 overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="font-semibold">Member</TableHead>
              <TableHead className="font-semibold">Role</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Joined / Invited</TableHead>
              {isOwner && <TableHead className="text-right font-semibold">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isOwner ? 5 : 4} className="text-center py-10 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
                    <p className="font-medium text-sm">No members found</p>
                    <p className="text-xs text-muted-foreground">Try clearing active search/role filters or invite a new member.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => {
                const normRole = normalizedRole(member.role);
                const isSelf = member.adminId === currentAdminId;
                const isSoleOwner = normRole === 'OWNER' && activeOwnersCount <= 1;
                const isPending = member.acceptedAt === null || (!member.isActive && !member.acceptedAt);
                const displayName = member.admin
                  ? `${member.admin.firstName} ${member.admin.lastName}`
                  : member.name || member.email;
                const displayEmail = member.admin?.email || member.email;
                const avatarUrl = member.admin?.avatarUrl;

                return (
                  <TableRow key={member.id} className="hover:bg-muted/30 transition-colors">
                    {/* Member Info */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-sm uppercase overflow-hidden">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                          ) : (
                            displayName.charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground flex items-center gap-2 text-sm">
                            <span>{displayName}</span>
                            {isSelf && (
                              <Badge variant="outline" className="text-[10px] py-0 h-4 bg-muted">
                                You
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{displayEmail}</div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Role */}
                    <TableCell>
                      {editingId === member.id ? (
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={selectedRole}
                            onValueChange={(v) => setSelectedRole(v as TeamRole)}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="OWNER">Owner</SelectItem>
                              <SelectItem value="ADMIN">Admin</SelectItem>
                              <SelectItem value="VIEWER">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleSaveRole(member.id)}
                            disabled={isLoading}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted"
                            onClick={() => setEditingId(null)}
                            disabled={isLoading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          {normRole === 'OWNER' && (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 font-medium">
                              <Crown className="h-3.5 w-3.5 text-amber-500" />
                              <span>Owner</span>
                            </Badge>
                          )}
                          {normRole === 'ADMIN' && (
                            <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1 font-medium">
                              <Shield className="h-3.5 w-3.5 text-blue-500" />
                              <span>Admin</span>
                            </Badge>
                          )}
                          {normRole === 'VIEWER' && (
                            <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30 gap-1 font-medium">
                              <Eye className="h-3.5 w-3.5 text-slate-500" />
                              <span>Viewer</span>
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      {isPending ? (
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 gap-1 text-xs font-normal">
                          <Clock className="h-3 w-3 text-yellow-500" />
                          <span>Pending Invite</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-xs font-normal">
                          <UserCheck className="h-3 w-3 text-emerald-500" />
                          <span>Active</span>
                        </Badge>
                      )}
                    </TableCell>

                    {/* Date */}
                    <TableCell className="text-xs text-muted-foreground">
                      {member.acceptedAt
                        ? new Date(member.acceptedAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : member.invitedAt
                        ? `Invited ${new Date(member.invitedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}`
                        : new Date(member.joinedAt || Date.now()).toLocaleDateString()}
                    </TableCell>

                    {/* Actions */}
                    {isOwner && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {editingId !== member.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              title={
                                isSelf
                                  ? 'You cannot change your own role'
                                  : isSoleOwner
                                  ? 'Cannot change role — sole owner'
                                  : 'Edit Role'
                              }
                              onClick={() => handleEditRole(member)}
                              disabled={isLoading || isSelf || isSoleOwner || editingId !== null}
                            >
                              <Edit2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title={
                              isSelf
                                ? 'You cannot remove yourself'
                                : isSoleOwner
                                ? 'Cannot remove sole owner'
                                : 'Remove Member'
                            }
                            onClick={() => setMemberToRemove(member)}
                            disabled={isLoading || isSelf || isSoleOwner}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirmation Dialog for Member Removal */}
      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              <span>Remove Team Member</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 pt-2">
              <span>
                Are you sure you want to remove{' '}
                <strong className="text-foreground">
                  {memberToRemove?.admin
                    ? `${memberToRemove.admin.firstName} ${memberToRemove.admin.lastName}`
                    : memberToRemove?.email}
                </strong>{' '}
                from this organization?
              </span>
              <p className="text-xs text-muted-foreground">
                This user will immediately lose access to all contests, settings, and workspace data within this organization.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? 'Removing...' : 'Remove Member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
