import React from 'react';
import { Clock, Send, Construction } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Wrapping in a span so the tooltip fires even when button is disabled */}
              <span className="w-full">
                <Button
                  variant="outline"
                  disabled
                  className="gap-2 w-full opacity-50 cursor-not-allowed"
                >
                  <Clock className="h-4 w-4" />
                  Schedule
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex items-center gap-1.5">
              <Construction className="h-3.5 w-3.5" />
              <span>Scheduled messaging coming soon</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
