'use client';

import { useState, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, Copy, MessageCircle, Trash2, MoreHorizontal } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { Registration } from '@/lib/types';

interface RegistrationsTableProps {
  registrations: Registration[];
  onRowClick?: (registration: Registration) => void;
  onBulkSelect?: (registrationIds: string[]) => void;
  onRevoke?: (registrationIds: string[]) => void;
  loading?: boolean;
}

const VIRTUAL_SCROLL_THRESHOLD = 50;

export function RegistrationsTable({
  registrations,
  onRowClick,
  onBulkSelect,
  onRevoke,
  loading = false
}: RegistrationsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'status'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const containerRef = useState<HTMLDivElement | null>(null)[0];

  const sortedRegistrations = useMemo(() => {
    const sorted = [...registrations];

    sorted.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortBy) {
        case 'name':
          aVal = a.participantDetails.fullName;
          bVal = b.participantDetails.fullName;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          aVal = new Date(a.registeredAt).getTime();
          bVal = new Date(b.registeredAt).getTime();
      }

      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1;
    });

    return sorted;
  }, [registrations, sortBy, sortDir]);

  const shouldVirtualize = sortedRegistrations.length > VIRTUAL_SCROLL_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: sortedRegistrations.length,
    getScrollElement: () => containerRef,
    estimateSize: () => 50,
    overscan: 10,
    enabled: shouldVirtualize
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === sortedRegistrations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedRegistrations.map(r => r.id)));
    }
  }, [sortedRegistrations]);

  const handleSelectRow = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleCopyId = useCallback((id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('Participant ID copied');
  }, []);

  const handleRevoke = useCallback(async () => {
    if (onRevoke && selectedIds.size > 0) {
      await onRevoke(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  }, [selectedIds, onRevoke]);

  const renderRow = (index: number) => {
    const registration = sortedRegistrations[index];

    return (
      <TableRow
        key={registration.id}
        onClick={() => onRowClick?.(registration)}
        className="cursor-pointer hover:bg-muted/50"
      >
        <TableCell>
          <Checkbox
            checked={selectedIds.has(registration.id)}
            onCheckedChange={() => handleSelectRow(registration.id)}
            onClick={e => e.stopPropagation()}
          />
        </TableCell>
        <TableCell className="font-mono text-sm">{registration.participantId}</TableCell>
        <TableCell>{registration.participantDetails.fullName}</TableCell>
        <TableCell>{registration.participantDetails.email}</TableCell>
        <TableCell>{registration.participantDetails.phone}</TableCell>
        <TableCell>
          <Badge
            variant={registration.status === 'confirmed' ? 'default' : 'secondary'}
          >
            {registration.status}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge
            variant={registration.paymentStatus === 'completed' ? 'default' : 'outline'}
          >
            {registration.paymentStatus}
          </Badge>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {new Date(registration.registeredAt).toLocaleDateString()}
        </TableCell>
        <TableCell onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleCopyId(registration.participantId)}>
                <Copy className="h-4 w-4 mr-2" />
                Copy ID
              </DropdownMenuItem>
              <DropdownMenuItem>
                <MessageCircle className="h-4 w-4 mr-2" />
                Send Message
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => {
                  setSelectedIds(new Set([registration.id]));
                  handleRevoke();
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Revoke
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    );
  };

  if (shouldVirtualize) {
    return (
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === sortedRegistrations.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => setSortBy('name')}>
                Participant ID {sortBy === 'name' && <ChevronDown className="h-3 w-3 inline" />}
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="cursor-pointer" onClick={() => setSortBy('status')}>
                Status {sortBy === 'status' && <ChevronDown className="h-3 w-3 inline" />}
              </TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="cursor-pointer" onClick={() => setSortBy('date')}>
                Date {sortBy === 'date' && <ChevronDown className="h-3 w-3 inline" />}
              </TableHead>
              <TableHead className="w-12">Actions</TableHead>
            </TableRow>
          </TableHeader>
        </Table>

        <div className="h-96 overflow-y-auto">
          <Table>
            <TableBody>
              {virtualRows.map((virtualRow) => (
                renderRow(virtualRow.index)
              ))}
            </TableBody>
          </Table>
          <div
            style={{
              height: totalSize - (virtualRows[virtualRows.length - 1]?.start ?? 0)
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedIds.size === sortedRegistrations.length}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead>Participant ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="w-12">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRegistrations.map((_, index) => renderRow(index))}
        </TableBody>
      </Table>
    </div>
  );
}
