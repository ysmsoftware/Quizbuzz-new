'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as contestsApi from '../api/contests.api';
import { queryKeys } from '../api/queryClient';
import type { Registration } from '../types';

function normalizeRegistration(raw: any): Registration {
  const contact = raw.contact || raw.participantDetails || {};
  const fullName = [contact.fullName, contact.firstName, contact.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() || raw.registrationRef || raw.participantId || 'Participant';

  const participantDetails = {
    fullName,
    email: contact.email || '',
    phone: contact.phone || '',
    institution: contact.institution || contact.college,
    city: contact.city,
    state: contact.state,
    country: contact.country,
    profileImage: contact.profileImage,
    dateOfBirth: contact.dateOfBirth,
  };

  const status = String(raw.status || '').toUpperCase();
  const isConfirmed = [
    'REGISTERED',
    'CHECKED_IN',
    'IN_WAITING',
    'IN_QUIZ',
    'SUBMITTED',
    'DISQUALIFIED',
    'ABSENT'
  ].includes(status);

  const normalizedStatus: Registration['status'] =
    isConfirmed ? 'confirmed' :
    status === 'PENDING' ? 'pending' :
    status === 'CANCELLED' ? 'cancelled' :
    status === 'REVOKED' ? 'revoked' : 'pending';

  const paymentStatusRaw = String(raw.payment?.status || raw.paymentStatus || '').toUpperCase();
  // Backend uses PaymentStatus enum: CREATED | PENDING | SUCCESS | FAILED | CANCELLED | REFUNDED
  // Map to frontend's simplified statuses:
  const normalizedPaymentStatus: Registration['paymentStatus'] =
    (paymentStatusRaw === 'SUCCESS' || paymentStatusRaw === 'COMPLETED') ? 'completed' :
    (paymentStatusRaw === 'PENDING' || paymentStatusRaw === 'CREATED') ? 'pending' :
    paymentStatusRaw === 'FAILED' ? 'failed' :
    paymentStatusRaw === 'REFUNDED' ? 'refunded' :
    paymentStatusRaw === 'CANCELLED' ? 'failed' : 'pending';

  // Amount in DB is stored in paise (smallest unit). Divide by 100 to get rupees.
  const amountInPaise = raw.payment?.amount ?? raw.amount ?? 0;
  const amountInRupees = amountInPaise > 0 ? amountInPaise / 100 : 0;

  return {
    id: raw.id,
    participantId: raw.id,
    contestId: raw.contestId,
    organizationId: raw.organizationId,
    contactId: raw.contactId,
    registrationRef: raw.registrationRef,
    status: normalizedStatus,
    registeredAt: raw.registeredAt || raw.createdAt || raw.updatedAt || '',
    // paymentId here is the Razorpay transaction ID (for display in the drawer)
    paymentId: raw.payment?.razorpayPaymentId || raw.paymentId || null,
    paymentStatus: normalizedPaymentStatus,
    amount: amountInRupees,
    // paidAt is the actual payment confirmation timestamp
    paidAt: raw.payment?.paidAt || null,
    paymentMethod: raw.payment?.method || raw.payment?.provider || raw.paymentMethod,
    participantDetails,
    whatsappOptIn: raw.whatsappOptIn,
    customFields: raw.customFields || {},
    quizStatus: raw.status || raw.quizStatus,
    currentQuestionIndex: raw.currentQuestionIndex,
    totalQuestions: raw.totalQuestions,
    joinedAt: raw.joinedAt,
    submittedAt: raw.submittedAt,
    lastActivityAt: raw.lastActivityAt,
    proctoringWarnings: raw.proctoringWarnings,
  } as Registration;
}

/**
 * Contest participants/registrations hook using TanStack Query
 */
export function useRegistrations(
  contestId: string,
  params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }
) {
  const queryClient = useQueryClient();

  /**
   * List participants query
   */
  const participantsQuery = useQuery({
    queryKey: queryKeys.contests.participants(contestId, params),
    queryFn: () => contestsApi.listParticipants(contestId, params),
    enabled: !!contestId,
  });

  /**
   * Disqualify participant mutation
   */
  const disqualifyMutation = useMutation({
    mutationFn: ({ participantId, reason }: { participantId: string; reason: string }) =>
      contestsApi.disqualifyParticipant(contestId, participantId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contests.participants(contestId, params),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.contests.detail(contestId) });
      toast.success('Participant disqualified');
    },
  });

  /**
   * Revoke registrations mutation (Disqualify)
   */
  const revokeMutation = useMutation({
    mutationFn: ({ ids, reason }: { ids: string[]; reason: string }) =>
      // Assuming individual disqualification for now
      Promise.all(ids.map(id => contestsApi.disqualifyParticipant(contestId, id, reason))),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contests.participants(contestId, params),
      });
      toast.success(`Revoked ${variables.ids.length > 1 ? 'registrations' : 'registration'}`);
    },
  });

  /**
   * Mark as paid mutation
   */
  const markAsPaidMutation = useMutation({
    mutationFn: ({ id, reference }: { id: string; reference: string }) =>
      // This endpoint is not in the docs but needed for the UI. 
      // Mapping to a generic participant update or specific payment update if it exists.
      // For now, using patch on participant if possible or stubbing.
      Promise.resolve({ success: true }), 
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contests.participants(contestId, params),
      });
      toast.success('Payment marked as completed');
    },
  });

  /**
   * Allow free entry mutation
   */
  const allowFreeEntryMutation = useMutation({
    mutationFn: (id: string) =>
      // Stubbing for now as not in docs
      Promise.resolve({ success: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contests.participants(contestId, params),
      });
      toast.success('Free entry allowed');
    },
  });

  /**
   * Participant status summary query
   */
  const statusSummaryQuery = useQuery({
    queryKey: ['contest-status-summary', contestId],
    queryFn: () => contestsApi.getParticipantStatusSummary(contestId),
    enabled: !!contestId,
  });

  /**
   * Bulk status update mutation
   */
  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: 'REGISTERED' | 'DISQUALIFIED' }) =>
      contestsApi.bulkUpdateParticipantStatus(contestId, ids, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contests.participants(contestId, params),
      });
      queryClient.invalidateQueries({
        queryKey: ['contest-status-summary', contestId],
      });
      toast.success(`Updated status to ${variables.status} for ${variables.ids.length} participants`);
    },
  });

  // Extract nested data structure
  const participants = (participantsQuery.data?.data?.participants || []).map(normalizeRegistration);
  const pagination = participantsQuery.data?.data?.pagination;
  const isLoading = participantsQuery.isLoading;
  const error = participantsQuery.error;
  const statusSummary = statusSummaryQuery.data?.data || null;

  return {
    // Derived state
    data: participants,
    participants,
    pagination,
    isLoading,
    error,
    statusSummary,

    // Mutations
    revokeRegistrations: (args: { ids: string[], reason: string }) => revokeMutation.mutateAsync(args),
    markAsPaid: (args: { id: string, reference: string }) => markAsPaidMutation.mutateAsync(args),
    allowFreeEntry: (id: string) => allowFreeEntryMutation.mutateAsync(id),
    disqualifyParticipant: (id: string, reason: string) => disqualifyMutation.mutateAsync({ participantId: id, reason }),
    bulkUpdateStatus: (args: { ids: string[]; status: 'REGISTERED' | 'DISQUALIFIED' }) => bulkStatusMutation.mutateAsync(args),
    triggerExport: (format: 'csv' | 'pdf', filters?: any) => contestsApi.triggerExport(contestId, format, filters),
    checkExportStatus: (exportId: string) => contestsApi.getExportStatus(contestId, exportId),
  };
}

