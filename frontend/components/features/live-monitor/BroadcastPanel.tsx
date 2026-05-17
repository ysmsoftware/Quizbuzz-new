'use client';

import { useState, useCallback } from 'react';
import { Send, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface BroadcastPanelProps {
  onSend?: (message: string, type: 'info' | 'warning' | 'urgent', target: 'all' | 'active' | 'waiting') => void;
  disabled?: boolean;
}

const MAX_CHAR_LIMIT = 280;

export function BroadcastPanel({ onSend, disabled = false }: BroadcastPanelProps) {
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'urgent'>('info');
  const [target, setTarget] = useState<'all' | 'active' | 'waiting'>('all');
  const [loading, setLoading] = useState(false);

  const remaining = MAX_CHAR_LIMIT - message.length;

  const handleSend = useCallback(async () => {
    if (!message.trim()) {
      toast.error('Message cannot be empty');
      return;
    }

    try {
      setLoading(true);
      onSend?.(message, type, target);
      setMessage('');
      setType('info');
      setTarget('all');
      toast.success('Message broadcast successfully');
    } catch (err) {
      toast.error('Failed to send broadcast');
    } finally {
      setLoading(false);
    }
  }, [message, type, target, onSend]);

  const typeIcons = {
    info: <Info className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    urgent: <AlertCircle className="h-4 w-4" />
  };

  const typeColors = {
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-amber-50 border-amber-200',
    urgent: 'bg-red-50 border-red-200'
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">Broadcast Message</CardTitle>
        <CardDescription>Send urgent messages to participants</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Message Input */}
        <div className="space-y-2">
          <Label htmlFor="message" className="text-sm">Message</Label>
          <Textarea
            id="message"
            placeholder="Type your message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHAR_LIMIT))}
            disabled={disabled || loading}
            className="resize-none min-h-24"
          />
          <div className="flex items-center justify-between">
            <span className={`text-xs ${remaining < 50 ? 'text-red-600' : 'text-muted-foreground'}`}>
              {remaining} characters remaining
            </span>
          </div>
        </div>

        {/* Message Type */}
        <div className="space-y-3">
          <Label className="text-sm">Type</Label>
          <RadioGroup value={type} onValueChange={(val) => setType(val as typeof type)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="info" id="type-info" />
              <Label htmlFor="type-info" className="flex items-center gap-2 cursor-pointer font-normal">
                <Info className="h-4 w-4 text-blue-600" />
                Info
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="warning" id="type-warning" />
              <Label htmlFor="type-warning" className="flex items-center gap-2 cursor-pointer font-normal">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Warning
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="urgent" id="type-urgent" />
              <Label htmlFor="type-urgent" className="flex items-center gap-2 cursor-pointer font-normal">
                <AlertCircle className="h-4 w-4 text-red-600" />
                Urgent
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Target */}
        <div className="space-y-3">
          <Label className="text-sm">Send To</Label>
          <RadioGroup value={target} onValueChange={(val) => setTarget(val as typeof target)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="target-all" />
              <Label htmlFor="target-all" className="cursor-pointer font-normal">
                All Participants
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="active" id="target-active" />
              <Label htmlFor="target-active" className="cursor-pointer font-normal">
                Active Now
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="waiting" id="target-waiting" />
              <Label htmlFor="target-waiting" className="cursor-pointer font-normal">
                In Waiting Room
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Preview */}
        {message && (
          <div className={`p-3 rounded-lg border ${typeColors[type]}`}>
            <div className="flex items-start gap-2">
              {typeIcons[type]}
              <div>
                <Badge className="mb-1" variant={type === 'info' ? 'default' : type === 'warning' ? 'secondary' : 'destructive'}>
                  {type.toUpperCase()}
                </Badge>
                <p className="text-sm">{message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled || loading}
          className="w-full mt-auto"
        >
          <Send className="h-4 w-4 mr-2" />
          {loading ? 'Sending...' : 'Send Broadcast'}
        </Button>
      </CardContent>
    </Card>
  );
}
