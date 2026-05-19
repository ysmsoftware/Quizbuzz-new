import { get, patch, post, del, ApiResponse } from './apiClient';

/**
 * Contact Types
 */
export interface Contact {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  college?: string;
  department?: string;
  city?: string;
  state?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    participants: number;
  };
}

export interface ContactHistoryItem {
  participantId: string;
  registrationRef: string;
  status: string;
  joinedAt: string;
  contest: {
    id: string;
    title: string;
    startTime: string;
    status: string;
  };
  payment: {
    status: string;
    amount: number;
  };
  submission?: {
    score: string;
    percentage: string;
    rank: number;
  };
}

export interface ContactsListResponse {
  data: Contact[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Message Types
 */
export interface MessageRecord {
  id: string;
  channel: 'WHATSAPP' | 'EMAIL';
  template: string;
  recipient: string;
  status: 'QUEUED' | 'PROCESSING' | 'SENT' | 'DELIVERED' | 'FAILED';
  sentAt?: string;
  deliveredAt?: string;
  retryCount: number;
  participant: {
    contact: {
      firstName: string;
      lastName: string;
    }
  }
}

export interface MessagesListResponse {
  data: MessageRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    sent: number;
    failed: number;
    pending: number;
  }
}

/**
 * CRM API Service
 */
export const crmApi = {
  // Contacts
  getContacts: (params?: { search?: string; college?: string; page?: number; limit?: number }) =>
    get<ContactsListResponse>('/contacts', { params }),

  getContactDetail: (contactId: string) =>
    get<Contact>(`/contacts/${contactId}`),
  // Historical / registration records for a contact.
  // The server exposes these under `/contacts/:id/contests` (registrations).
  getContactHistory: (contactId: string) =>
    get<ContactHistoryItem[]>(`/contacts/${contactId}/contests`),

  // Alternative / explicit method names that map to documented endpoints
  getContactRegistrations: (contactId: string) =>
    get<ContactHistoryItem[]>(`/contacts/${contactId}/contests`),

  getContactMessages: (contactId: string) =>
    get<MessagesListResponse>(`/contacts/${contactId}/messages`),

  getContactCertificates: (contactId: string) =>
    get<any>(`/contacts/${contactId}/certificates`),

  lookupContact: (params: { email?: string; phone?: string }) =>
    get<Contact | null>(`/contacts/lookup`, { params }),

  createContact: (body: Partial<Contact>) =>
    post<Contact>(`/contacts`, body),

  deleteContact: (contactId: string) =>
    del<any>(`/contacts/${contactId}`),

  updateContact: (contactId: string, body: Partial<Contact>) =>
    patch<Contact>(`/contacts/${contactId}`, body),

  // Messaging
  getContestMessages: (contestId: string, params?: { channel?: string; status?: string; template?: string; page?: number; limit?: number }) =>
    get<MessagesListResponse>(`/messages/contests/${contestId}`, { params }),

  getMessageDetail: (messageId: string) =>
    get<MessageRecord>(`/messages/${messageId}`),

  retryMessage: (messageId: string) =>
    post<any>(`/messages/${messageId}/retry`),

  sendBulkMessage: (body: { 
    contestId: string; 
    channel: 'EMAIL' | 'WHATSAPP'; 
    subject?: string; 
    body: string; 
    template: string; 
  }) =>
    post<any>('/messages/bulk', body),
};
