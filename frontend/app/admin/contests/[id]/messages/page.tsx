'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send, AlertCircle, RefreshCcw, CheckCircle2, XCircle, Clock, MessageSquare, ChevronLeft, ChevronRight, ConstructionIcon } from 'lucide-react';
import { toast } from 'sonner';
import { MessageTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useMessageTemplates } from '@/lib/hooks/useMessageTemplates';
import { useMessageSending } from '@/lib/hooks/useMessageSending';
import { useRecipientFilter } from '@/lib/hooks/useRecipientFilter';
import { TemplateCard } from '@/components/features/messaging/TemplateCard';
import { RecipientSelector } from '@/components/features/messaging/RecipientSelector';
import { ChannelSelector } from '@/components/features/messaging/ChannelSelector';
import { MessagePreview } from '@/components/features/messaging/MessagePreview';
import { crmApi } from '@/lib/api/crm.api';
import { messageService } from '@/lib/services/message-service';
import { format } from 'date-fns';
import type { MessageChannel, RecipientFilter } from '@/lib/types';
import { useQuery as useRQQuery } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function MessagesPage() {
  const params = useParams();
  const contestId = params.id as string;
  const queryClient = useQueryClient();

  // State
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<MessageChannel>('email');
  const [sentPage, setSentPage] = useState(1);

  // Hooks
  const { templates, loading: templatesLoading } = useMessageTemplates('org-1');
  const { filter: recipientFilter, setFilter: setRecipientFilter, count: recipientCount, loading: recipientFilterLoading } =
    useRecipientFilter(contestId);
  const { sendNow, loading: sendingLoading, error: sendingError } = useMessageSending();

  // Real sent history from backend
  const { data: sentData, isLoading: sentLoading } = useRQQuery({
    queryKey: ['contest-messages', contestId, sentPage],
    queryFn: () => crmApi.getContestMessages(contestId, { page: sentPage, limit: 15 }),
    enabled: !!contestId,
  });

  const sentMessages = sentData?.data?.data ?? [];
  const sentPagination = sentData?.data?.pagination;
  const sentSummary = sentData?.data?.summary;

  // Recipient counts for the audience selector
  const allCountQuery = useRQQuery({
    queryKey: ['recipient-count', contestId, 'all'],
    queryFn: () => messageService.calculateRecipientCount(contestId, 'all'),
    enabled: !!contestId,
  });
  const confirmedCountQuery = useRQQuery({
    queryKey: ['recipient-count', contestId, 'confirmed'],
    queryFn: () => messageService.calculateRecipientCount(contestId, 'confirmed'),
    enabled: !!contestId,
  });
  const paidCountQuery = useRQQuery({
    queryKey: ['recipient-count', contestId, 'paid'],
    queryFn: () => messageService.calculateRecipientCount(contestId, 'paid'),
    enabled: !!contestId,
  });

  const recipientCounts = {
    all: allCountQuery.data ?? 0,
    confirmed: confirmedCountQuery.data ?? 0,
    paid: paidCountQuery.data ?? 0,
  };
  const recipientLoading = recipientFilterLoading || allCountQuery.isLoading;

  const retryMutation = useMutation({
    mutationFn: (msgId: string) => crmApi.retryMessage(msgId),
    onSuccess: () => {
      toast.success('Message re-queued for delivery');
      queryClient.invalidateQueries({ queryKey: ['contest-messages', contestId] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to retry message'),
  });

  const handleSendMessage = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }
    try {
      await sendNow({
        contestId,
        templateId: selectedTemplate.id,
        recipientFilter: recipientFilter as RecipientFilter,
        channel: selectedChannel,
      });
      toast.success('Message sent successfully');
      setSelectedTemplate(null);
      queryClient.invalidateQueries({ queryKey: ['contest-messages', contestId] });
    } catch (err) {
      toast.error(sendingError || 'Failed to send message');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED': return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1"><CheckCircle2 className="h-3 w-3" />Delivered</Badge>;
      case 'SENT': return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1"><Send className="h-3 w-3" />Sent</Badge>;
      case 'FAILED': return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Failed</Badge>;
      case 'PROCESSING': return <Badge className="bg-primary/10 text-primary border-primary/20 gap-1"><RefreshCcw className="h-3 w-3 animate-spin" />Processing</Badge>;
      case 'QUEUED': return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1"><Clock className="h-3 w-3" />Queued</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground mt-1">
          Send notifications to contest participants via WhatsApp and Email.
        </p>
      </div>

      <Tabs defaultValue="send" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="send">Send Message</TabsTrigger>
          <TabsTrigger value="history">
            Sent History {sentSummary && `(${sentSummary.sent ?? 0})`}
          </TabsTrigger>
        </TabsList>

        {/* ── SEND TAB ─────────────────────────────────────────────────── */}
        <TabsContent value="send" className="space-y-6 mt-6">
          {sendingError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{sendingError}</AlertDescription>
            </Alert>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left: Template selector */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Select Template</CardTitle>
                  <CardDescription>
                    Choose from your organisation's message templates (managed in the backend).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {templatesLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    </div>
                  ) : (
                    <ScrollArea className="h-[320px] pr-2">
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
                        {templates.length === 0 && (
                          <p className="text-center text-muted-foreground py-8 text-sm">
                            No templates available from backend.
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: Config + send */}
            <div className="space-y-4">
              {selectedTemplate ? (
                <>
                  {/* Channel */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Channel</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChannelSelector value={selectedChannel} onChange={setSelectedChannel} />
                    </CardContent>
                  </Card>

                  {/* Recipients */}
                  <Card>
                    <CardHeader className="pb-2">
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

                  {/* Scheduling — coming soon notice */}
                  <Card className="border-dashed border-amber-200 bg-amber-50/40">
                    <CardContent className="pt-4 pb-3 flex items-start gap-2.5">
                      <ConstructionIcon className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-700 leading-relaxed">
                        <span className="font-semibold">Scheduled messaging is coming soon.</span>{' '}
                        Currently, messages are sent immediately upon confirmation.
                      </p>
                    </CardContent>
                  </Card>

                  {/* Preview */}
                  <Card>
                    <CardHeader className="pb-2">
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

                  {/* Send */}
                  <Button
                    onClick={handleSendMessage}
                    disabled={sendingLoading || !selectedTemplate}
                    className="w-full shadow-lg shadow-primary/20"
                    size="lg"
                  >
                    {sendingLoading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                    ) : (
                      <><Send className="h-4 w-4 mr-2" />Send Message</>
                    )}
                  </Button>
                </>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="pt-8 pb-8 text-center text-muted-foreground space-y-2">
                    <Send className="h-8 w-8 mx-auto opacity-30" />
                    <p className="text-sm font-medium">Select a template to continue</p>
                    <p className="text-xs opacity-70">Channel and audience options will appear here.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── SENT HISTORY TAB ─────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-6">
          {/* Summary stats */}
          {sentSummary && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Delivered', value: sentSummary.sent ?? 0, cls: 'text-green-600' },
                { label: 'Failed', value: sentSummary.failed ?? 0, cls: 'text-destructive' },
                { label: 'Pending', value: sentSummary.pending ?? 0, cls: 'text-amber-600' },
              ].map((s) => (
                <Card key={s.label} className="border-border/50">
                  <CardContent className="py-4 text-center">
                    <p className={`text-2xl font-black ${s.cls}`}>{s.value}</p>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card className="rounded-2xl border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border/40">
                  <tr>
                    <th className="text-left font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-5 py-3">Recipient</th>
                    <th className="text-left font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-4 py-3">Channel / Template</th>
                    <th className="text-left font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-left font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-4 py-3">Sent At</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {sentLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse border-b border-border/20">
                        <td colSpan={5} className="h-14 px-5">
                          <div className="h-4 bg-muted rounded w-3/4" />
                        </td>
                      </tr>
                    ))
                  ) : sentMessages.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto opacity-20 mb-2" />
                        <p className="text-sm">No messages sent yet for this contest.</p>
                      </td>
                    </tr>
                  ) : (
                    sentMessages.map((msg) => (
                      <tr key={msg.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-sm">
                            {msg.contact ? `${msg.contact.firstName} ${msg.contact.lastName ?? ''}` : 'Recipient'}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">{msg.recipient}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-xs text-primary">{msg.channel}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{msg.template}</p>
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(msg.status)}
                          {msg.retryCount > 0 && (
                            <p className="text-[9px] text-muted-foreground mt-1">Retried {msg.retryCount}×</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {msg.sentAt ? format(new Date(msg.sentAt), 'MMM d, HH:mm') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {msg.status === 'FAILED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs rounded-lg"
                              onClick={() => retryMutation.mutate(msg.id)}
                              disabled={retryMutation.isPending}
                            >
                              <RefreshCcw className="h-3 w-3 mr-1" />
                              Retry
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {sentPagination && sentPagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border/40 bg-muted/10">
                <p className="text-xs text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{sentMessages.length}</span> of{' '}
                  <span className="font-semibold text-foreground">{sentPagination.total}</span> messages
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-8"
                    onClick={() => setSentPage((p) => Math.max(1, p - 1))}
                    disabled={sentPage === 1}
                  >
                    <ChevronLeft className="h-3 w-3 mr-1" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-8"
                    onClick={() => setSentPage((p) => Math.min(sentPagination.totalPages, p + 1))}
                    disabled={sentPage === sentPagination.totalPages}
                  >
                    Next
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
