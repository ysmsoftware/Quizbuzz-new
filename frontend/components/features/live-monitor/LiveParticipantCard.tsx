'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { LiveParticipant } from '@/lib/hooks/useAdminContestSocket';

interface LiveParticipantCardProps {
  participant: LiveParticipant;
  onClick?: () => void;
}

export function LiveParticipantCard({
  participant,
  onClick
}: LiveParticipantCardProps) {
  const initials = participant.name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Deterministic color based on participant ID
  const avatarColor = useMemo(() => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-green-500',
      'bg-orange-500',
      'bg-red-500',
      'bg-cyan-500',
      'bg-indigo-500'
    ];
    const hash = participant.participantId.charCodeAt(0);
    return colors[hash % colors.length];
  }, [participant.participantId]);

  const progressPercent = (participant.currentQuestion / participant.totalQuestions) * 100;

  const statusConfig = {
    active: { color: 'bg-green-500', label: 'Active' },
    submitted: { color: 'bg-blue-500', label: 'Submitted' },
    flagged: { color: 'bg-red-500', label: 'Flagged' },
    disconnected: { color: 'bg-gray-400', label: 'Disconnected' }
  };

  const statusStyle = statusConfig[participant.status];
  const showTimeWarning = participant.timeOnQuestion > 180; // 3 minutes

  const lastUpdatedMinutesAgo = Math.floor(
    (Date.now() - new Date(participant.lastActivityAt).getTime()) / 60000
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="cursor-pointer"
    >
      <Card
        className={`p-4 border-l-4 ${
          participant.status === 'active'
            ? 'border-green-500'
            : participant.status === 'flagged'
            ? 'border-red-500'
            : participant.status === 'submitted'
            ? 'border-blue-500'
            : 'border-gray-400'
        } hover:shadow-lg transition-shadow`}
      >
        {/* Header with avatar and status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white text-sm font-bold`}
            >
              {initials}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm truncate">{participant.name}</p>
              <p className="text-xs text-muted-foreground">ID: {participant.participantId.slice(-6)}</p>
            </div>
          </div>

          <Badge className={statusStyle.color}>
            {statusStyle.label}
          </Badge>
        </div>

        {/* Progress */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">
              Q {participant.currentQuestion}/{participant.totalQuestions}
            </span>
            <span className="text-xs text-muted-foreground">{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Time on question */}
        <div className="flex items-center justify-between mb-3 p-2 rounded bg-muted/50">
          {showTimeWarning ? (
            <div className="flex items-center gap-2 text-xs text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Spent {Math.floor(participant.timeOnQuestion / 60)}m {participant.timeOnQuestion % 60}s</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{Math.floor(participant.timeOnQuestion / 60)}m {participant.timeOnQuestion % 60}s on Q</span>
            </div>
          )}
        </div>

        {/* Alerts badge */}
        {participant.proctoringAlerts > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-600 font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            {participant.proctoringAlerts} alert{participant.proctoringAlerts > 1 ? 's' : ''}
          </div>
        )}

        {/* Last updated */}
        <p className="text-xs text-muted-foreground mt-2">
          Updated {lastUpdatedMinutesAgo}m ago
        </p>
      </Card>
    </motion.div>
  );
}
