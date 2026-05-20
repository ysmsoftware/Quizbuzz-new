import { MessageTemplate, MessageDraft, SentMessage, RecipientFilter, MessageChannel } from '@/lib/types';
import { crmApi } from '@/lib/api/crm.api';
import { getContest, listParticipants } from '@/lib/api/contests.api';

class MessageService {
  async getTemplates(orgId: string): Promise<MessageTemplate[]> {
    try {
      const res = await crmApi.getMessageTemplates();
      if (res.success && Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    } catch (e) {
      console.error('Failed to fetch message templates from backend:', e);
      return [];
    }
  }

  async getTemplateById(id: string): Promise<MessageTemplate | null> {
    const templates = await this.getTemplates('all');
    return templates.find(t => t.id === id) || null;
  }

  async createTemplate(data: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<MessageTemplate> {
    throw new Error('Template creation is managed in the backend repository.');
  }

  async updateTemplate(id: string, data: Partial<MessageTemplate>): Promise<MessageTemplate | null> {
    throw new Error('Template update is managed in the backend repository.');
  }

  async deleteTemplate(id: string): Promise<boolean> {
    throw new Error('Template deletion is managed in the backend repository.');
  }

  async calculateRecipientCount(contestId: string, filter: RecipientFilter): Promise<number> {
    if (!contestId || contestId === 'all') return 0;
    try {
      const res = await listParticipants(contestId, {
        limit: 1000,
        status: filter === 'all' ? undefined : filter
      });
      return res?.data?.participants?.length || 0;
    } catch {
      return 0;
    }
  }

  async sendMessage(
    contestId: string,
    templateId: string,
    recipientFilter: RecipientFilter,
    channel: MessageChannel,
    selectedParticipantIds?: string[]
  ): Promise<SentMessage> {
    // 1. Fetch template & contest info
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    let contestTitle = 'QuizBuzz Contest';
    let contestDate = new Date().toLocaleDateString();
    let contestStartTime = new Date().toLocaleTimeString();
    let contestLink = typeof window !== 'undefined' ? `${window.location.origin}/contests/${contestId}` : '';

    if (contestId && contestId !== 'all') {
      try {
        const cRes = await getContest(contestId);
        if (cRes.success && cRes.data) {
          contestTitle = cRes.data.title || contestTitle;
          if (cRes.data.startTime) {
            const startDate = new Date(cRes.data.startTime);
            contestDate = startDate.toLocaleDateString();
            contestStartTime = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
        }
      } catch (e) {
        console.warn('Failed to fetch contest detail in sendMessage', e);
      }
    }

    // 2. Fetch targeted participants
    let participants: any[] = [];
    if (contestId && contestId !== 'all') {
      try {
        const pRes = await listParticipants(contestId, {
          limit: 1000,
          status: recipientFilter === 'all' ? undefined : recipientFilter
        });
        if (pRes.success && pRes.data?.participants) {
          participants = pRes.data.participants;
        }
      } catch (e) {
        console.error('Failed to list participants for sending message', e);
      }
    }

    // Filter by selected IDs if in bulk/selection mode
    if (selectedParticipantIds && selectedParticipantIds.length > 0) {
      participants = participants.filter(p => selectedParticipantIds.includes(p.id) || selectedParticipantIds.includes(p.participantId));
    }

    if (participants.length === 0) {
      throw new Error('No participants found matching current criteria.');
    }

    const channelEnum = channel.toUpperCase() as 'EMAIL' | 'WHATSAPP';

    let successCount = 0;
    let failCount = 0;

    // 3. Dispatch calls concurrently
    await Promise.all(
      participants.map(async (p) => {
        const details = p.participantDetails || {};
        const fullName = details.fullName || 'Participant';
        const email = details.email;
        const phone = details.phone;
        const recipient = channel === 'email' ? email : phone;

        if (!recipient) {
          failCount++;
          return;
        }

        // Interpolate templates for custom message bodies
        let interpolatedBody = template.body
          .replace(/\{\{name\}\}/g, fullName)
          .replace(/\{\{fullName\}\}/g, fullName)
          .replace(/\{\{eventName\}\}/g, contestTitle)
          .replace(/\{\{contestTitle\}\}/g, contestTitle)
          .replace(/\{\{contestDate\}\}/g, contestDate)
          .replace(/\{\{contestStartTime\}\}/g, contestStartTime)
          .replace(/\{\{contestLink\}\}/g, contestLink)
          .replace(/\{\{reason\}\}/g, 'Evaluation policy violation')
          .replace(/\{\{resultsLink\}\}/g, `${contestLink}/results`)
          .replace(/\{\{certificateLink\}\}/g, `${contestLink}/certificate`);

        const parameters: Record<string, string> = {
          name: fullName,
          eventName: contestTitle,
          date: contestDate,
          time: contestStartTime,
          link: contestLink,
          subject: template.name,
          body: interpolatedBody,
        };

        try {
          await crmApi.sendMessage({
            participantId: p.id,
            contestId: contestId !== 'all' ? contestId : undefined,
            channel: channelEnum,
            template: templateId,
            recipient,
            subject: template.name,
            body: interpolatedBody,
            parameters,
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to send message to ${recipient}`, err);
          failCount++;
        }
      })
    );

    const sentMessageRecord: SentMessage = {
      id: `msg-${Date.now()}`,
      contestId,
      templateId,
      channel,
      sentAt: new Date().toISOString(),
      totalRecipients: participants.length,
      deliveredCount: successCount,
      failedCount: failCount,
      status: failCount === 0 ? 'sent' : failCount === participants.length ? 'failed' : 'sent',
    };

    return sentMessageRecord;
  }

  async scheduleMessage(
    contestId: string,
    templateId: string,
    recipientFilter: RecipientFilter,
    channel: MessageChannel,
    scheduledFor: string
  ): Promise<MessageDraft> {
    const count = await this.calculateRecipientCount(contestId, recipientFilter);
    const draft: MessageDraft = {
      id: `draft-${Date.now()}`,
      contestId,
      templateId,
      channel,
      recipientFilter,
      recipientCount: count,
      scheduledFor,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };
    return draft;
  }

  async getSentMessages(contestId: string): Promise<SentMessage[]> {
    return [];
  }

  async getScheduledMessages(contestId: string): Promise<MessageDraft[]> {
    return [];
  }

  async cancelScheduled(id: string): Promise<boolean> {
    return true;
  }

  async getDeliveryStatus(messageId: string): Promise<{ delivered: number; failed: number; total: number } | null> {
    return null;
  }
}

export const messageService = new MessageService();
