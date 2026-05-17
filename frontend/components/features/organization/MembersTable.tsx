import { useState } from 'react';
import { Trash2, Shield, Edit2, Check, X } from 'lucide-react';
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
import { TeamMember, TeamRole } from '@/lib/types';

interface MembersTableProps {
  members: TeamMember[];
  onRemove: (memberId: string) => Promise<void>;
  onUpdateRole: (memberId: string, role: TeamRole) => Promise<void>;
  isLoading?: boolean;
}

export function MembersTable({
  members,
  onRemove,
  onUpdateRole,
  isLoading = false,
}: MembersTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<TeamRole>('editor');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleEditRole = (member: TeamMember) => {
    setEditingId(member.id);
    setSelectedRole(member.role);
  };

  const handleSaveRole = async (memberId: string) => {
    await onUpdateRole(memberId, selectedRole);
    setEditingId(null);
  };

  const handleRemove = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      await onRemove(memberId);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
              No team members yet
            </TableCell>
          </TableRow>
        ) : (
          members.map((member) => (
            <TableRow key={member.id}>
              <TableCell className="font-medium">{member.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{member.email}</TableCell>
              <TableCell>
                {editingId === member.id ? (
                  <div className="flex gap-2">
                    <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as TeamRole)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSaveRole(member.id)}
                      disabled={isLoading}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm capitalize">{member.role}</span>
                  </div>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(member.joinedAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {editingId !== member.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditRole(member)}
                      disabled={isLoading || editingId !== null}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemove(member.id)}
                    disabled={isLoading || removingId !== null}
                    className="text-destructive hover:text-destructive"
                  >
                    {removingId === member.id ? (
                      <span className="text-xs">Removing...</span>
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
