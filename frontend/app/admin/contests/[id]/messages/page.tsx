'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { MessageTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMessageTemplates } from '@/lib/hooks/useMessageTemplates';
import { useMessageSending } from '@/lib/hooks/useMessageSending';
import { useSentMessages } from '@/lib/hooks/useSentMessages';
import { useScheduledMessages } from '@/lib/hooks/useScheduledMessages';
import { useRecipientFilter } from '@/lib/hooks/useRecipientFilter';
import { TemplateBuilder } from '@/components/features/messaging/TemplateBuilder';
import { TemplateCard } from '@/components/features/messaging/TemplateCard';
import { RecipientSelector } from '@/components/features/messaging/RecipientSelector';
import { ChannelSelector } from '@/components/features/messaging/ChannelSelector';
import { ScheduleToggle } from '@/components/features/messaging/ScheduleToggle';
import { SentHistoryTable } from '@/components/features/messaging/SentHistoryTable';
import { ScheduledMessagesTable } from '@/components/features/messaging/ScheduledMessagesTable';
import { MessagePreview } from '@/components/features/messaging/MessagePreview';
import type { MessageChannel, RecipientFilter } from '@/lib/types';

export default function MessagesPage() {
  const params = useParams();
  const contestId = params.id as string;

  // State
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<MessageChannel>('whatsapp');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [templateBuilderOpen, setTemplateBuilderOpen] = useState(false);

  // Hooks
  const { templates, customTemplates, createTemplate, loading: templatesLoading } =
    useMessageTemplates('org-1');
  const { filter: recipientFilter, setFilter: setRecipientFilter, count: recipientCount, loading: recipientLoading } =
    useRecipientFilter(contestId);
  const { sendNow, scheduleMessage, loading: sendingLoading, error: sendingError } =
    useMessageSending();
  const { messages: sentMessages, loading: sentLoading } = useSentMessages(contestId);
  const { messages: scheduledMessages, loading: scheduledLoading, cancelScheduled } =
    useScheduledMessages(contestId);

  // Recipient counts
  const [recipientCounts, setRecipientCounts] = useState({
    all: 500,
    confirmed: 450,
    paid: 375,
  });

  useEffect(() => {
    // Simulate loading recipient counts
    setRecipientCounts({
      all: 500,
      confirmed: 450,
      paid: 375,
    });
  }, [contestId]);

  const handleSendMessage = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    try {
      if (isScheduled) {
        if (!scheduledTime) {
          toast.error('Please select a time to schedule');
          return;
        }
        await scheduleMessage({
          contestId,
          templateId: selectedTemplate.id,
          recipientFilter: recipientFilter as RecipientFilter,
          channel: selectedChannel,
          scheduledFor: new Date(scheduledTime).toISOString(),
        });
        toast.success('Message scheduled successfully');
      } else {
        await sendNow({
          contestId,
          templateId: selectedTemplate.id,
          recipientFilter: recipientFilter as RecipientFilter,
          channel: selectedChannel,
        });
        toast.success('Message sent successfully');
      }

      setSelectedTemplate(null);
      setSelectedChannel('whatsapp');
      setIsScheduled(false);
    } catch (err) {
      toast.error(sendingError || 'Failed to send message');
    }
  };

  const handleCreateTemplate = async (template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await createTemplate(template);
      toast.success('Template created successfully');
      setTemplateBuilderOpen(false);
    } catch (err) {
      toast.error('Failed to create template');
    }
  };

  const handleCancelScheduled = async (id: string) => {
    try {
      const success = await cancelScheduled(id);
      if (success) {
        toast.success('Scheduled message cancelled');
      } else {
        toast.error('Failed to cancel scheduled message');
      }
    } catch (err) {
      toast.error('Error cancelling scheduled message');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Messages & Templates</h1>
        <p className="text-muted-foreground mt-2">
          Send notifications to participants via WhatsApp and Email
        </p>
      </div>

      <Tabs defaultValue="send" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="send">Send Message</TabsTrigger>
          <TabsTrigger value="scheduled">
            Scheduled {scheduledMessages.length > 0 && `(${scheduledMessages.length})`}
          </TabsTrigger>
          <TabsTrigger value="history">Sent History</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* Send Message Tab */}
        <TabsContent value="send" className="space-y-6">
          {sendingError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{sendingError}</AlertDescription>
            </Alert>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Select Template */}
              <Card>
                <CardHeader>
                  <CardTitle>Select Template</CardTitle>
                  <CardDescription>Choose a template or create a new one</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    variant="outline"
                    onClick={() => setTemplateBuilderOpen(true)}
                    className="w-full"
                  >
                    + Create New Template
                  </Button>

                  <div className="grid gap-3">
                    {templates.map((template: MessageTemplate) => (
                      <div
                        key={template.id}
                        onClick={() => setSelectedTemplate(template)}
                        className="cursor-pointer"
                      >
                        <TemplateCard
                          template={template}
                          selected={selectedTemplate?.id === template.id}
                        />
                      </div>
                    ))}
                  </div>

                  {templates.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No templates available. Create one to get started.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Preview & Actions */}
            <div className="space-y-6">
              {selectedTemplate && (
                <>
                  {/* Channel Selector */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Channel</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChannelSelector
                        value={selectedChannel}
                        onChange={setSelectedChannel}
                      />
                    </CardContent>
                  </Card>

                  {/* Recipient Selector */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Recipients</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RecipientSelector
                        selectedFilter={recipientFilter}
                        onFilterChange={setRecipientFilter}
                        recipientCounts={recipientCounts}
                        loading={recipientLoading}
                      />
                    </CardContent>
                  </Card>

                  {/* Schedule Selector */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Send Timing</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScheduleToggle
                        isScheduled={isScheduled}
                        onToggle={setIsScheduled}
                        scheduledTime={scheduledTime}
                        onTimeChange={setScheduledTime}
                      />
                    </CardContent>
                  </Card>

                  {/* Message Preview */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MessagePreview
                        body={selectedTemplate.body}
                        channel={selectedChannel}
                        variables={selectedTemplate.variables}
                      />
                    </CardContent>
                  </Card>

                  {/* Send Button */}
                  <Button
                    onClick={handleSendMessage}
                    disabled={sendingLoading || !selectedTemplate}
                    className="w-full"
                    size="lg"
                  >
                    {sendingLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {isScheduled ? 'Schedule' : 'Send'} Message
                  </Button>
                </>
              )}

              {!selectedTemplate && (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    <Send className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Select a template to get started</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Scheduled Messages Tab */}
        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Messages</CardTitle>
              <CardDescription>Messages waiting to be sent</CardDescription>
            </CardHeader>
            <CardContent>
              <ScheduledMessagesTable
                messages={scheduledMessages}
                loading={scheduledLoading}
                onCancel={handleCancelScheduled}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sent History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Sent History</CardTitle>
              <CardDescription>All messages sent to participants</CardDescription>
            </CardHeader>
            <CardContent>
              <SentHistoryTable messages={sentMessages} loading={sentLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Templates</CardTitle>
                <CardDescription>Manage custom message templates</CardDescription>
              </div>
              <Button onClick={() => setTemplateBuilderOpen(true)}>
                + Create Template
              </Button>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {customTemplates.map((template: MessageTemplate) => (
                    <TemplateCard key={template.id} template={template} />
                  ))}

                  {customTemplates.length === 0 && (
                    <p className="col-span-full text-center text-muted-foreground py-8">
                      No custom templates yet. Create one to get started.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Builder Modal */}
      <TemplateBuilder
        open={templateBuilderOpen}
        onOpenChange={setTemplateBuilderOpen}
        onSave={handleCreateTemplate}
      />
    </div>
  );
}
