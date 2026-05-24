import type { Contest } from '@/lib/types';

export interface ChecklistItem {
  label: string;
  done: boolean;
  required: boolean;
  warning?: boolean;
}

/** Publish checklist derived only from API contest data — no local state. */
export function buildPublishChecklist(contest: Contest): ChecklistItem[] {
  const questionCount = contest._count?.questions ?? contest.totalQuestions ?? 0;

  return [
    {
      label: 'Title added',
      done: !!contest.title?.trim(),
      required: true,
    },
    {
      label: 'Start date set',
      done: !!contest.startTime,
      required: true,
    },
    {
      label: 'At least 1 rule added',
      done: (contest.rules?.length ?? 0) > 0,
      required: true,
    },
    {
      label: 'At least 1 prize defined',
      done: (contest.prizes?.length ?? 0) > 0,
      required: false,
    },
    {
      label: `Questions added (${questionCount} of recommended 10+)`,
      done: questionCount > 0,
      required: true,
      warning: questionCount > 0 && questionCount < 10,
    },
    {
      label: contest.fee > 0 ? 'Fee configured' : 'Free contest toggled',
      done: true,
      required: false,
    },
  ];
}
