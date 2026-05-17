import { MockDB } from './db';
import type { Registration, QuizAttempt } from '@/lib/types';
import type { Contact, Payment } from './db';

// ============================================
// RELATION HELPERS - Join functions for MockDB
// ============================================

export interface RegistrationWithContact extends Registration {
  contactDetails?: Contact;
}

export interface PaymentWithContact extends Payment {
  contactDetails?: Contact;
}

export interface LiveParticipant {
  participantId: string;
  name: string;
  avatarInitials: string;
  currentQuestion: number;
  answeredCount: number;
  totalQuestions: number;
  estimatedCorrect: number;
  estimatedScorePercent: number;
  timeRemainingSeconds: number;
  status: 'active' | 'submitted' | 'disconnected' | 'flagged';
  proctoringAlerts: number;
  lastActivityAt: string;
  isInWaitingRoom: boolean;
  timeOnQuestion: number;
}

export interface ContestWithStats {
  id: string;
  title: string;
  registeredCount: number;
  confirmedCount: number;
  paidCount: number;
  submittedCount: number;
  revenue: number;
}

export interface ContactWithHistory extends Contact {
  registrations: Registration[];
  submissions: QuizAttempt[];
}

export interface ContestAnalytics {
  contestId: string;
  totalRegistered: number;
  totalConfirmed: number;
  totalPaid: number;
  totalSubmitted: number;
  totalRevenue: number;
  conversionRate: number;
  completionRate: number;
  averageScore?: number;
}

export interface OrgAnalytics {
  totalContests: number;
  totalRegistrations: number;
  totalRevenue: number;
  totalParticipants: number;
  conversionRate: number;
  topContests: string[];
}

/**
 * Get a contest with its stats
 */
export function getContestWithStats(contestId: string): ContestWithStats {
  const contest = MockDB.contests.find(c => c.id === contestId);
  if (!contest) {
    return {
      id: contestId,
      title: 'Unknown',
      registeredCount: 0,
      confirmedCount: 0,
      paidCount: 0,
      submittedCount: 0,
      revenue: 0,
    };
  }

  const registrations = MockDB.registrations.filter(r => r.contestId === contestId);
  const confirmed = registrations.filter(r => r.status === 'confirmed').length;
  const paid = registrations.filter(r => r.paymentStatus === 'completed').length;
  const submitted = MockDB.submissions.filter(s => s.contestId === contestId).length;
  const revenue = paid * (contest.registrationFee || 0);

  return {
    id: contest.id,
    title: contest.title,
    registeredCount: registrations.length,
    confirmedCount: confirmed,
    paidCount: paid,
    submittedCount: submitted,
    revenue: revenue,
  };
}

/**
 * Get all registrations for a contest with contact details
 */
export function getRegistrationsForContest(contestId: string): RegistrationWithContact[] {
  return MockDB.registrations
    .filter(r => r.contestId === contestId)
    .map(reg => {
      const contact = MockDB.contacts.find(c => c.id === `contact-${reg.id.split('-')[1].slice(-3)}`);
      return {
        ...reg,
        contactDetails: contact || {
          id: `contact-${reg.id.split('-')[1].slice(-3)}`,
          fullName: reg.participantDetails.fullName,
          email: reg.participantDetails.email,
          phone: reg.participantDetails.phone,
          country: reg.participantDetails.country || 'India',
          createdAt: reg.registeredAt,
        } as any,
      };
    });
}

/**
 * Get all payments for a contest with contact details
 */
export function getPaymentsForContest(contestId: string): PaymentWithContact[] {
  return MockDB.payments
    .filter(p => p.contestId === contestId)
    .map(payment => {
      const contact = MockDB.contacts.find(c => c.id === payment.contactId);
      return {
        ...payment,
        contactDetails: contact,
      };
    });
}

/**
 * Get all submissions for a contest with contact details
 */
export function getSubmissionsForContest(contestId: string) {
  return MockDB.submissions
    .filter(s => s.contestId === contestId)
    .map(submission => {
      const attempt = (MockDB.attempts as any[]).find(a => a.id === `attempt-${submission.registrationId}`);
      const registration = MockDB.registrations.find(r => r.id === attempt?.registrationId);
      const contact = registration ? MockDB.contacts.find(c => c.id === `contact-${registration.id.split('-')[1].slice(-3)}`) : undefined;

      return {
        ...submission,
        registration,
        contactDetails: contact || registration?.participantDetails,
      };
    });
}

/**
 * Get all certificates for a contest with contact details
 */
export function getCertificatesForContest(contestId: string) {
  return (MockDB.certificates as any[])
    .filter(c => c.contestId === contestId)
    .map(cert => {
      const contact = MockDB.contacts.find(c => c.id === cert.contactId);
      return {
        ...cert,
        contactDetails: contact,
      };
    });
}

/**
 * Get live participants for a contest - used in admin live monitor
 * This generates simulated participant state based on deterministic but varied logic
 */
export function getLiveParticipantsForContest(contestId: string): LiveParticipant[] {
  const contest = MockDB.contests.find(c => c.id === contestId);
  if (!contest) return [];

  const regs = MockDB.registrations.filter(r => r.contestId === contestId && r.status === 'confirmed');
  const totalQuestions = contest.totalQuestions;

  // Limit to first 20 for display
  return regs.slice(0, 20).map((reg, i) => {
    const contact = MockDB.contacts.find(c => c.id === `contact-${reg.id.split('-')[1].slice(-3)}`);
    const name = contact?.fullName || reg.participantDetails?.fullName || 'Anonymous Participant';

    // Deterministic but varied state based on index
    const progress = Math.min(totalQuestions, Math.floor((i / 20) * totalQuestions) + Math.floor(Math.random() * 3));
    const statuses: LiveParticipant['status'][] = ['active', 'active', 'active', 'submitted', 'disconnected', 'flagged'];

    return {
      participantId: reg.id,
      name,
      avatarInitials: name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
      currentQuestion: progress + 1,
      answeredCount: progress,
      totalQuestions,
      estimatedCorrect: Math.floor(progress * 0.7),
      estimatedScorePercent: Math.floor((progress / totalQuestions) * 70),
      timeRemainingSeconds: Math.max(0, 1800 - i * 90),
      status: statuses[i % statuses.length],
      proctoringAlerts: i % 5 === 0 ? 1 : 0,
      lastActivityAt: new Date(Date.now() - i * 30000).toISOString(),
      isInWaitingRoom: false,
      timeOnQuestion: (i * 17) % 240,
    };
  });
}

/**
 * Get contact with their full history
 */
export function getContactWithHistory(contactId: string): ContactWithHistory {
  const contact = MockDB.contacts.find(c => c.id === contactId);
  if (!contact) {
    throw new Error(`Contact ${contactId} not found`);
  }

  const registrations = MockDB.registrations.filter(r => r.participantId === `part-${contactId.split('-')[1].padStart(4, '0')}`);
  const submissions = MockDB.attempts.filter(a => registrations.some(reg => reg.id === a.registrationId));

  return {
    ...contact,
    registrations,
    submissions,
  };
}

/**
 * Get analytics for a specific contest
 */
export function getAnalyticsForContest(contestId: string): ContestAnalytics {
  const registrations = MockDB.registrations.filter(r => r.contestId === contestId);
  const confirmed = registrations.filter(r => r.status === 'confirmed').length;
  const paid = registrations.filter(r => r.paymentStatus === 'completed').length;
  const submitted = MockDB.submissions.filter(s => s.contestId === contestId).length;

  const contest = MockDB.contests.find(c => c.id === contestId);
  const totalRevenue = paid * (contest?.registrationFee || 0);

  return {
    contestId,
    totalRegistered: registrations.length,
    totalConfirmed: confirmed,
    totalPaid: paid,
    totalSubmitted: submitted,
    totalRevenue,
    conversionRate: registrations.length > 0 ? confirmed / registrations.length : 0,
    completionRate: confirmed > 0 ? submitted / confirmed : 0,
    averageScore: submitted > 0 ? 65 : undefined,
  };
}

/**
 * Get organization-wide analytics
 */
export function getOrgAnalytics(): OrgAnalytics {
  const allRegistrations = MockDB.registrations;
  const allConfirmed = allRegistrations.filter(r => r.status === 'confirmed');
  const totalSubmitted = MockDB.submissions.length;

  const contestStats = MockDB.contests.map(c => ({
    id: c.id,
    submitted: MockDB.submissions.filter(s => s.contestId === c.id).length,
  }));

  const topContests = contestStats
    .sort((a, b) => b.submitted - a.submitted)
    .slice(0, 5)
    .map(c => c.id);

  const totalRevenue = MockDB.payments.reduce((sum, p) => sum + p.amount, 0);

  return {
    totalContests: MockDB.contests.length,
    totalRegistrations: allRegistrations.length,
    totalRevenue,
    totalParticipants: MockDB.contacts.length,
    conversionRate: allRegistrations.length > 0 ? allConfirmed.length / allRegistrations.length : 0,
    topContests,
  };
}

/**
 * Get template by event type
 */
export function getMessageTemplateByEvent(systemEvent: string) {
  return MockDB.messageTemplates.find(t => t.systemEvent === systemEvent);
}

/**
 * Get all sent messages for a contest
 */
export function getSentMessagesForContest(contestId: string) {
  return MockDB.sentMessages.filter(m => m.contestId === contestId);
}
