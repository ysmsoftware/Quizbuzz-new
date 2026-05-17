import React from 'react';
import { Clock, Send } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ScheduleToggleProps {
  isScheduled: boolean;
  onToggle: (scheduled: boolean) => void;
  scheduledTime: string;
  onTimeChange: (time: string) => void;
}

export function ScheduleToggle({
  isScheduled,
  onToggle,
  scheduledTime,
  onTimeChange,
}: ScheduleToggleProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Send Option</Label>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={!isScheduled ? 'default' : 'outline'}
          onClick={() => onToggle(false)}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          Send Now
        </Button>
        <Button
          variant={isScheduled ? 'default' : 'outline'}
          onClick={() => onToggle(true)}
          className="gap-2"
        >
          <Clock className="h-4 w-4" />
          Schedule
        </Button>
      </div>

      {isScheduled && (
        <div className="space-y-2 pt-2 border-t">
          <Label htmlFor="schedule-time" className="text-sm">
            Schedule For
          </Label>
          <Input
            id="schedule-time"
            type="datetime-local"
            value={scheduledTime}
            onChange={(e) => onTimeChange(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
          />
          <p className="text-xs text-muted-foreground">
            Message will be sent at the specified date and time
          </p>
        </div>
      )}
    </div>
  );
}
