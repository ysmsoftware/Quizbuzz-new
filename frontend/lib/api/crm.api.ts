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
  collegeId?: string | null;
  departmentId?: string | null;
  city?: string;
  state?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    participants: number;
  };
}

export interface ContactPaymentOrder {
  id: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string | null;
  amount: number;
  status: string;
  method?: string | null;
  failureReason?: string | null;
  errorReason?: string | null;
  createdAt: string;
}

export interface ContactHistoryItem {
  participantId: string;
  registrationRef: string;
  status: string;
  registeredAt: string;
  checkedInAt?: string | null;
  joinedAt?: string | null;
  disqualificationReason?: string | null;
  contestId: string;
  contestTitle: string;
  contestSlug: string;
  contestStartTime?: string | null;
  /** Rupees; 0 = free contest. */
  contestPrice?: number;
  payment?: {
    id: string;
    status: string;
    /** Rupees. */
    amount?: number;
    currency: string;
    razorpayOrderId?: string | null;
    razorpayPaymentId?: string | null;
    paidAt?: string | null;
    attempts: number;
    failureReason?: string | null;
    createdAt: string;
    orders: ContactPaymentOrder[];
  };
  certificate?: {
    id: string;
    status: 'PENDING' | 'GENERATED' | 'FAILED' | 'QUEUED' | 'GENERATING' | string;
    generatedAt?: string | null;
    deliveredAt?: string | null;
    fileUrl?: string | null;
  };
  submission?: {
    id: string;
    status: string;
    submittedAt?: string | null;
    score: string;
    percentage: string;
    rank: number;
    totalQuestions?: number | null;
    attempted?: number | null;
    correct?: number | null;
    wrong?: number | null;
    skipped?: number | null;
    isPassed?: boolean | null;
    timeTakenSecs?: number | null;
  };
}

/** Row from GET /contacts/:id/messages (only messages tied to one of the contact's registrations). */
export interface ContactMessageItem {
  id: string;
  channel: 'WHATSAPP' | 'EMAIL' | string;
  template: string;
  status: string;
  recipient: string;
  subject: string | null;
  failureReason: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  contestId: string | null;
  contestTitle: string | null;
  createdAt: string;
}

export type ContactSortField = 'firstName' | 'lastName' | 'email' | 'college' | 'city' | 'createdAt';

export type ContactListParams = {
  search?: string;
  college?: string;
  collegeId?: string;
  /** First letter of first name, or "#" for non A–Z. */
  letter?: string;
  city?: string;
  state?: string;
  sortBy?: ContactSortField;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

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
  subject?: string;
  body?: string;
  parameters?: Record<string, string>;
  status: 'QUEUED' | 'PROCESSING' | 'SENT' | 'DELIVERED' | 'FAILED';
  /** Booked send time while QUEUED behind the mailbox's hourly cap. */
  scheduledFor?: string | null;
  /** Why it's waiting (e.g. hourly email limit reached). */
  statusReason?: string | null;
  sentAt?: string;
  deliveredAt?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  contact?: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
    phone: string | null;
  };
  contest?: {
    id: string;
    title: string;
  };
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
  // Server returns { data, total, page, limit, totalPages } — reshape to the { data, pagination } the UI reads.
  getContacts: async (params?: ContactListParams) => {
    const response = await get<any>('/contacts', { params });
    const { data, total = 0, page = 1, limit = params?.limit ?? 20, totalPages = 0 } = response.data ?? {};
    return {
      ...response,
      data: { data: (data ?? []) as Contact[], pagination: { page, limit, total, totalPages } } as ContactsListResponse,
    };
  },

  getContactDetail: (contactId: string) =>
    get<Contact>(`/contacts/${contactId}`),
  // Historical / registration records for a contact.
  // The server exposes these under `/contacts/:id/contests` (registrations).
  getContactHistory: (contactId: string) =>
    get<ContactHistoryItem[]>(`/contacts/${contactId}/contests`),

  // Alternative / explicit method names that map to documented endpoints
  getContactRegistrations: (contactId: string) =>
    get<ContactHistoryItem[]>(`/contacts/${contactId}/contests`),

  getContactMessages: (contactId: string, params?: { page?: number; limit?: number }) =>
    get<{ data: ContactMessageItem[]; total: number; totalPages: number }>(`/contacts/${contactId}/messages`, { params }),

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

  getContestMessages: async (contestId: string, params?: { channel?: string; status?: string; template?: string; page?: number; limit?: number }) => {
    const response = await get<any>(`/messaging/contest/${contestId}`, { params });
    if (response.success && response.data) {
      const { data, total, page, limit, totalPages, summary } = response.data;
      return {
        ...response,
        data: {
          data: data || [],
          pagination: {
            page: page || 1,
            limit: limit || 20,
            total: total || 0,
            totalPages: totalPages || 1,
          },
          summary: summary || { sent: 0, failed: 0, pending: 0 },
        }
      } as ApiResponse<MessagesListResponse>;
    }
    return response as unknown as ApiResponse<MessagesListResponse>;
  },

  getMessageDetail: (messageId: string) =>
    get<MessageRecord>(`/messaging/${messageId}`),

  retryMessage: (messageId: string) =>
    post<any>(`/messaging/${messageId}/retry`),

  sendMessage: (body: {
    participantId?: string;
    contactId?: string;
    contestId?: string;
    channel: 'EMAIL' | 'WHATSAPP';
    template: string;
    recipient: string;
    subject?: string;
    body?: string;
    parameters?: Record<string, string>;
  }) =>
    post<any>('/messaging/send', body),

  retryFailedMessages: () =>
    post<any>('/messaging/retry-failed'),

  getMessageTemplates: () =>
    get<any>('/messaging/templates'),
};
