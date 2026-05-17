import React from 'react';
import { MessageChannel } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MessageCircle, Mail } from 'lucide-react';

interface ChannelSelectorProps {
  value: MessageChannel;
  onChange: (channel: MessageChannel) => void;
}

export function ChannelSelector({ value, onChange }: ChannelSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Send Via</Label>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as MessageChannel)}>
        <div className="space-y-3">
          <div className="flex items-start space-x-3 p-3 rounded-lg border border-transparent hover:border-input cursor-pointer transition-colors"
            onClick={() => onChange('whatsapp')}
          >
            <RadioGroupItem value="whatsapp" id="whatsapp" className="mt-1" />
            <div className="flex-1 min-w-0">
              <Label htmlFor="whatsapp" className="font-medium text-foreground cursor-pointer">
                WhatsApp Only
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Send via WhatsApp to registered phone numbers
              </p>
            </div>
            <MessageCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          </div>

          <div className="flex items-start space-x-3 p-3 rounded-lg border border-transparent hover:border-input cursor-pointer transition-colors"
            onClick={() => onChange('email')}
          >
            <RadioGroupItem value="email" id="email" className="mt-1" />
            <div className="flex-1 min-w-0">
              <Label htmlFor="email" className="font-medium text-foreground cursor-pointer">
                Email Only
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Send via email to registered addresses
              </p>
            </div>
            <Mail className="h-5 w-5 text-blue-600 flex-shrink-0" />
          </div>

          <div className="flex items-start space-x-3 p-3 rounded-lg border border-transparent hover:border-input cursor-pointer transition-colors"
            onClick={() => onChange('both')}
          >
            <RadioGroupItem value="both" id="both" className="mt-1" />
            <div className="flex-1 min-w-0">
              <Label htmlFor="both" className="font-medium text-foreground cursor-pointer">
                Both WhatsApp & Email
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Send through both channels for maximum reach
              </p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <MessageCircle className="h-5 w-5 text-green-600" />
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>
      </RadioGroup>
    </div>
  );
}
