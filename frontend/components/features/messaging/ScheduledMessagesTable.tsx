import React from 'react';
import { MessageDraft } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Mail, Clock, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ScheduledMessagesTableProps {
  messages: MessageDraft[];
  loading?: boolean;
  onCancel?: (id: string) => Promise<void>;
}

export function ScheduledMessagesTable({
  messages,
  loading,
  onCancel,
}: ScheduledMessagesTableProps) {
  const [cancelling, setCancelling] = React.useState<string | null>(null);

  const handleCancel = async (id: string) => {
    if (!onCancel) return;
    
    setCancelling(id);
    try {
      await onCancel(id);
    } finally {
      setCancelling(null);
    }
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading scheduled messages...</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">No scheduled messages</p>
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
            <TableHead>Scheduled For</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
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
                  {message.recipientCount}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {message.scheduledFor
                      ? formatDistanceToNow(new Date(message.scheduledFor), {
                          addSuffix: true,
                        })
                      : 'Not scheduled'}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">Pending</Badge>
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCancel(message.id)}
                  disabled={cancelling === message.id}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
