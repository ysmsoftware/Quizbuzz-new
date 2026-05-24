'use client';

import { getParticipantSubmission } from '@/lib/api/submissions.api';

export function useParticipantSubmission() {
  const fetchParticipantSubmission = async (
    participantId: string,
    params?: { contestId?: string; contestSlug?: string }
  ) => {
    return getParticipantSubmission(participantId, params);
  };

  return {
    fetchParticipantSubmission,
  };
}
