import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { MessageTemplate, MessageChannel } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { VariableInserter } from './VariableInserter';
import { MessagePreview } from './MessagePreview';

interface TemplateBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  initialTemplate?: MessageTemplate;
  loading?: boolean;
}

const COMMON_VARIABLES = [
  'fullName',
  'contestName',
  'participantId',
  'contestDate',
  'contestTime',
  'startTime',
  'score',
  'rank',
  'quizUrl',
  'resultUrl',
  'certificateUrl',
];

export function TemplateBuilder({
  open,
  onOpenChange,
  onSave,
  initialTemplate,
  loading = false,
}: TemplateBuilderProps) {
  const [name, setName] = useState(initialTemplate?.name || '');
  const [channel, setChannel] = useState<MessageChannel>(initialTemplate?.channel || 'whatsapp');
  const [body, setBody] = useState(initialTemplate?.body || '');
  const [selectedVariables, setSelectedVariables] = useState<string[]>(
    initialTemplate?.variables || []
  );

  const handleInsertVariable = (variable: string) => {
    const textareaElement = document.getElementById('message-body') as HTMLTextAreaElement;
    if (!textareaElement) return;

    const start = textareaElement.selectionStart;
    const end = textareaElement.selectionEnd;
    const newBody = body.substring(0, start) + `{{${variable}}}` + body.substring(end);
    setBody(newBody);

    // Add to selected variables if not already there
    if (!selectedVariables.includes(variable)) {
      setSelectedVariables([...selectedVariables, variable]);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !body.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    await onSave({
      name,
      channel,
      body,
      variables: selectedVariables,
      orgId: 'org-1',
      isSystem: false,
    });

    setName('');
    setChannel('whatsapp');
    setBody('');
    setSelectedVariables([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialTemplate ? 'Edit Template' : 'Create New Template'}
          </DialogTitle>
          <DialogDescription>
            Create a reusable message template with variables for your contests
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              placeholder="e.g., Contest Reminder"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Channel Selection */}
          <div className="space-y-3">
            <Label>Channel</Label>
            <RadioGroup value={channel} onValueChange={(value) => setChannel(value as MessageChannel)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="whatsapp" id="whatsapp" />
                <Label htmlFor="whatsapp" className="font-normal cursor-pointer">
                  WhatsApp Only
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="email" id="email" />
                <Label htmlFor="email" className="font-normal cursor-pointer">
                  Email Only
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="both" id="both" />
                <Label htmlFor="both" className="font-normal cursor-pointer">
                  Both (WhatsApp + Email)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Message Body */}
          <div className="space-y-2">
            <Label htmlFor="message-body">Message Body</Label>
            <Textarea
              id="message-body"
              placeholder="Enter your message here. Use {{variable}} to insert dynamic content."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use variables like <code>{"{{fullName}}"}</code> to personalize messages. Variables will be replaced with actual values.
            </p>
          </div>

          {/* Variable Inserter */}
          <VariableInserter variables={COMMON_VARIABLES} onInsertVariable={handleInsertVariable} />

          {/* Preview */}
          <MessagePreview body={body} channel={channel} variables={selectedVariables} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {initialTemplate ? 'Update' : 'Create'} Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
