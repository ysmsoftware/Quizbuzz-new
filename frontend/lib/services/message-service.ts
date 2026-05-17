import { MessageTemplate, MessageDraft, SentMessage, RecipientFilter, MessageChannel, MessageStatus } from '@/lib/types';
import { MockDB } from '@/lib/mock/db';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock data stores
let messageTemplates: MessageTemplate[] = MockDB.messageTemplates;

// TEMPLATE DEFINITIONS REMOVED - Now using MockDB.messageTemplates

let sentMessages: SentMessage[] = [];
let scheduledMessages: MessageDraft[] = [];

class MessageService {
  async getTemplates(orgId: string): Promise<MessageTemplate[]> {
    await delay(300);
    return messageTemplates;
  }

  async getTemplateById(id: string): Promise<MessageTemplate | null> {
    await delay(200);
    return messageTemplates.find(t => t.id === id) || null;
  }

  async createTemplate(data: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<MessageTemplate> {
    await delay(400);
    
    const template: MessageTemplate = {
      ...data,
      id: `tpl-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    messageTemplates.push(template);
    return template;
  }

  async updateTemplate(id: string, data: Partial<MessageTemplate>): Promise<MessageTemplate | null> {
    await delay(400);
    
    const index = messageTemplates.findIndex(t => t.id === id);
    if (index === -1) return null;
    
    const updated = {
      ...messageTemplates[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    
    messageTemplates[index] = updated;
    return updated;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    await delay(300);
    
    const template = messageTemplates.find(t => t.id === id);
    if (!template || template.isSystem) return false;
    
    messageTemplates = messageTemplates.filter(t => t.id !== id);
    return true;
  }

  async calculateRecipientCount(contestId: string, filter: RecipientFilter): Promise<number> {
    await delay(200);
    
    // Mock counts based on filter
    const baseCount = 500;
    switch (filter) {
      case 'confirmed':
        return Math.floor(baseCount * 0.9);
      case 'paid':
        return Math.floor(baseCount * 0.75);
      case 'all':
      default:
        return baseCount;
    }
  }

  async sendMessage(
    contestId: string,
    templateId: string,
    recipientFilter: RecipientFilter,
    channel: MessageChannel
  ): Promise<SentMessage> {
    await delay(1500);
    
    const recipientCount = await this.calculateRecipientCount(contestId, recipientFilter);
    
    const message: SentMessage = {
      id: `msg-${Date.now()}`,
      contestId,
      templateId,
      channel,
      sentAt: new Date().toISOString(),
      totalRecipients: recipientCount,
      deliveredCount: Math.floor(recipientCount * 0.98),
      failedCount: Math.floor(recipientCount * 0.02),
      status: 'sent',
    };
    
    sentMessages.push(message);
    return message;
  }

  async scheduleMessage(
    contestId: string,
    templateId: string,
    recipientFilter: RecipientFilter,
    channel: MessageChannel,
    scheduledFor: string
  ): Promise<MessageDraft> {
    await delay(400);
    
    const recipientCount = await this.calculateRecipientCount(contestId, recipientFilter);
    
    const draft: MessageDraft = {
      id: `draft-${Date.now()}`,
      contestId,
      templateId,
      channel,
      recipientFilter,
      recipientCount,
      scheduledFor,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };
    
    scheduledMessages.push(draft);
    return draft;
  }

  async getSentMessages(contestId: string): Promise<SentMessage[]> {
    await delay(300);
    return sentMessages.filter(m => m.contestId === contestId).sort((a, b) => 
      new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    );
  }

  async getScheduledMessages(contestId: string): Promise<MessageDraft[]> {
    await delay(300);
    return scheduledMessages.filter(m => m.contestId === contestId && m.status === 'scheduled');
  }

  async cancelScheduled(id: string): Promise<boolean> {
    await delay(300);
    
    const index = scheduledMessages.findIndex(m => m.id === id);
    if (index === -1) return false;
    
    scheduledMessages[index].status = 'draft';
    return true;
  }

  async getDeliveryStatus(messageId: string): Promise<{ delivered: number; failed: number; total: number } | null> {
    await delay(200);
    
    const message = sentMessages.find(m => m.id === messageId);
    if (!message) return null;
    
    return {
      delivered: message.deliveredCount,
      failed: message.failedCount,
      total: message.totalRecipients,
    };
  }
}

export const messageService = new MessageService();
