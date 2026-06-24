'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Users, 
  Mail, 
  MessageSquare, 
  Send, 
  Loader2, 
  AlertCircle,
  FileText,
  Sparkles
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { messageService } from '@/lib/services/message-service';
import { useMessageTemplates } from '@/lib/hooks/useMessageTemplates';
import { useMessageSending } from '@/lib/hooks/useMessageSending';
import { useContact } from '@/lib/hooks/useContact';
import { ChannelSelector } from './ChannelSelector';
import { MessagePreview } from './MessagePreview';
import { TemplateCard } from './TemplateCard';
import type { MessageChannel, RecipientFilter, MessageTemplate } from '@/lib/types';

interface SendMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contestId: string;
  selectedParticipantIds?: string[];
  contactId?: string | null; // optional single-contact direct message
}

export function SendMessageModal({
  open,
  onOpenChange,
  contestId,
  selectedParticipantIds = [],
  contactId = null
}: SendMessageModalProps) {
  // State
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<MessageChannel>('email');
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>('all');

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setSelectedTemplate(null);
      setSelectedChannel('email');
      setRecipientFilter('all');
    }
  }, [open]);

  // Hook for message sending mutations
  const { sendNow, sendDirect, loading: sendingLoading, error: sendingError } = useMessageSending();

  // Hook for templates loading
  const { templates, loading: templatesLoading } = useMessageTemplates('org-1');

  // Query client for cache invalidation
  const queryClient = useQueryClient();

  // Dynamic recipient count queries calling messageService.calculateRecipientCount
  const allCountQuery = useQuery({
    queryKey: ['recipient-count', contestId, 'all'],
    queryFn: () => messageService.calculateRecipientCount(contestId, 'all'),
    enabled: open && !!contestId && selectedParticipantIds.length === 0,
  });

  const confirmedCountQuery = useQuery({
    queryKey: ['recipient-count', contestId, 'confirmed'],
    queryFn: () => messageService.calculateRecipientCount(contestId, 'confirmed'),
    enabled: open && !!contestId && selectedParticipantIds.length === 0,
  });

  const paidCountQuery = useQuery({
    queryKey: ['recipient-count', contestId, 'paid'],
    queryFn: () => messageService.calculateRecipientCount(contestId, 'paid'),
    enabled: open && !!contestId && selectedParticipantIds.length === 0,
  });

  const isBulkMode = selectedParticipantIds.length > 0;
  const isDirectMode = !!contactId;
  
  // Calculate selected count
  const recipientCount = isDirectMode
    ? 1
    : isBulkMode
      ? selectedParticipantIds.length
      : (recipientFilter === 'all'
          ? allCountQuery.data
          : recipientFilter === 'confirmed'
            ? confirmedCountQuery.data
            : paidCountQuery.data) ?? 0;

  // If direct mode, load contact details from the centralized contact hook
  const { contact } = useContact(contactId ?? '', {
    enabled: open && isDirectMode && !!contactId,
    loadHistory: false,
    loadMessages: false,
    loadCertificates: false,
  });

  const handleSend = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a message template');
      return;
    }

    try {
      if (isDirectMode) {
        if (!contact) {
          toast.error('Contact not found');
          return;
        }

        const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || contact.phone || 'Recipient';
        // Basic interpolation for well-known placeholders
        let interpolatedBody = selectedTemplate.body
          .replace(/\{\{name\}\}/g, contact.firstName || fullName)
          .replace(/\{\{fullName\}\}/g, fullName)
          .replace(/\{\{eventName\}\}/g, '')
          .replace(/\{\{contestTitle\}\}/g, '')
          .replace(/\{\{contestDate\}\}/g, '')
          .replace(/\{\{contestStartTime\}\}/g, '')
          .replace(/\{\{contestLink\}\}/g, '');

        const recipient = selectedChannel === 'email' ? contact.email : contact.phone;
        if (!recipient) {
          toast.error('Selected contact does not have a recipient for the chosen channel');
          return;
        }

        await sendDirect({
          contactId: contact.id,
          contestId: contestId && contestId !== 'all' ? contestId : undefined,
          channel: selectedChannel,
          templateId: selectedTemplate.id,
          recipient,
          subject: selectedTemplate.name,
          body: interpolatedBody,
          parameters: {
            name: fullName,
            subject: selectedTemplate.name,
            body: interpolatedBody,
          },
        });


        toast.success(`Message successfully sent to ${fullName}`);
        onOpenChange(false);
        return;
      }

      // existing bulk / contest send
      await sendNow({
        contestId,
        templateId: selectedTemplate.id,
        recipientFilter: isBulkMode ? 'all' : recipientFilter,
        channel: selectedChannel,
        selectedParticipantIds: isBulkMode ? selectedParticipantIds : undefined,
      });
      // Refresh messages list
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast.success(`Message successfully sent to ${recipientCount} recipient(s)`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(sendingError || err?.message || 'Failed to send message');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[95vw] md:max-w-5xl lg:max-w-6xl max-h-[90vh] flex flex-col p-0 border border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
        <div className="flex flex-col h-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20 shrink-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              {isBulkMode ? `Send Bulk Message (${selectedParticipantIds.length} Selected)` : 'Send Broadcast Message'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Select a design template, communication channel, and schedule options to notify participants.
            </DialogDescription>
          </DialogHeader>

          {/* Modal Body */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 items-start overflow-y-auto flex-1">
            {/* Left Column: Form Controls */}
            <div className="space-y-6">
              {/* Recipients Detail / Filter */}
              {isBulkMode ? (
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
                  <Users className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm text-primary">Targeting Selected Registrations</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your message will only be sent to the {selectedParticipantIds.length} selected participant(s).
                    </p>
                  </div>
                </div>
              ) : isDirectMode ? (
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
                  <Users className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm text-primary">Direct Message</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Sending a direct message to <span className="font-bold">{contact ? `${contact.firstName} ${contact.lastName ?? ''}`.trim() : 'selected contact'}</span>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Target Audience
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'all', label: 'All Registered', count: allCountQuery.data ?? 0, loading: allCountQuery.isLoading },
                      { value: 'confirmed', label: 'Confirmed Only', count: confirmedCountQuery.data ?? 0, loading: confirmedCountQuery.isLoading },
                      { value: 'paid', label: 'Paid Only', count: paidCountQuery.data ?? 0, loading: paidCountQuery.isLoading }
                    ].map((filterOpt) => (
                      <Button
                        key={filterOpt.value}
                        variant={recipientFilter === filterOpt.value ? 'default' : 'outline'}
                        onClick={() => setRecipientFilter(filterOpt.value as RecipientFilter)}
                        className="h-auto min-h-16 py-2.5 px-1.5 flex flex-col items-center justify-center gap-1 rounded-xl transition-all border-border/50 hover:bg-accent/40 whitespace-normal text-center leading-tight"
                      >
                        <span className="text-xs font-semibold text-center break-words">{filterOpt.label}</span>
                        {filterOpt.loading ? (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : (
                          <span className="text-[10px] bg-secondary text-secondary-foreground font-black px-1.5 py-0.5 rounded-full mt-0.5">
                            {filterOpt.count}
                          </span>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Channel Selector */}
              <ChannelSelector value={selectedChannel} onChange={setSelectedChannel} />

              {/* Templates Selector */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Message Template
                </label>
                
                {templatesLoading ? (
                  <div className="flex items-center justify-center h-[320px] border rounded-xl border-dashed">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <ScrollArea className="h-[320px] border border-border/50 rounded-xl p-3 bg-muted/10">
                    <div className="grid grid-cols-1 gap-2.5">
                      {templates.map((tpl) => (
                        <TemplateCard
                          key={tpl.id}
                          template={tpl}
                          selected={selectedTemplate?.id === tpl.id}
                          onSelect={() => setSelectedTemplate(tpl)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

            </div>

            {/* Right Column: Preview Panel */}
            <div className="sticky top-0 space-y-4 lg:border-l lg:pl-6 border-border/30">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">Live Message Preview</h4>
                {selectedTemplate && (
                  <span className="text-xs text-muted-foreground italic font-medium">
                    {selectedTemplate.name}
                  </span>
                )}
              </div>

              {selectedTemplate ? (
                <MessagePreview
                  body={selectedTemplate.body}
                  channel={selectedChannel}
                  variables={selectedTemplate.variables}
                />
              ) : (
                <div className="flex flex-col items-center justify-center min-h-64 border rounded-2xl border-dashed border-border/60 bg-muted/5 text-center p-6">
                  <AlertCircle className="h-10 w-10 text-muted-foreground/60 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground">No template selected</p>
                  <p className="text-xs text-muted-foreground/80 mt-1 max-w-xs">
                    Please select a template from the left side to preview the formatted notification text.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Dialog Footer */}
          <DialogFooter className="p-6 border-t border-border/40 bg-muted/20 gap-2 sm:gap-0 shrink-0">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border-border/60"
            >
              Cancel
            </Button>
            <Button
              disabled={sendingLoading || !selectedTemplate || (recipientCount === 0)}
              onClick={handleSend}
              className="bg-primary text-primary-foreground font-semibold px-6 shadow-lg shadow-primary/20 rounded-xl"
            >
              {sendingLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {isDirectMode ? 'Send Direct' : isBulkMode ? 'Send Bulk' : 'Send Broadcast'}
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
