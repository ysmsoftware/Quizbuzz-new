import React from 'react';
import { SentMessage } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Mail, BarChart3 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SentHistoryTableProps {
  messages: SentMessage[];
  loading?: boolean;
}

export function SentHistoryTable({ messages, loading }: SentHistoryTableProps) {
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageCircle className="h-4 w-4 text-green-600" />;
      case 'email':
        return <Mail className="h-4 w-4 text-blue-600" />;
      case 'both':
        return (
          <div className="flex gap-1">
            <MessageCircle className="h-4 w-4 text-green-600" />
            <Mail className="h-4 w-4 text-blue-600" />
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-800">Sent</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800">Partial</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      default:
        return null;
    }
  };

  const getDeliveryRate = (message: SentMessage): string => {
    if (message.totalRecipients === 0) return '0%';
    const rate = ((message.deliveredCount / message.totalRecipients) * 100).toFixed(1);
    return `${rate}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading sent messages...</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">No sent messages yet</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted">
            <TableHead>Channel</TableHead>
            <TableHead>Recipients</TableHead>
            <TableHead>Delivery Rate</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {messages.map((message) => (
            <TableRow key={message.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getChannelIcon(message.channel)}
                  <span className="capitalize text-sm">
                    {message.channel === 'both' ? 'Both' : message.channel}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm font-medium">
                  {message.deliveredCount}/{message.totalRecipients}
                </span>
                <p className="text-xs text-muted-foreground">
                  {message.failedCount > 0 && `${message.failedCount} failed`}
                </p>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{getDeliveryRate(message)}</span>
                </div>
              </TableCell>
              <TableCell>
                {getStatusBadge(message.status)}
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(message.sentAt), { addSuffix: true })}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
