'use client';

import { differenceInCalendarDays, format } from 'date-fns';
import { Trophy, Users, HelpCircle, Layers } from 'lucide-react';
import type { OrgPlanUsage } from '@/lib/api/organization.api';

interface PlanUsageBarsProps {
  usage: OrgPlanUsage;
}

interface UsageRow {
  key: string;
  label: string;
  icon: typeof Trophy;
  used: number;
  limit: number | null;
}

/**
 * Presentational only — all the numbers here come from the backend
 * (GET /org/:orgId/usage, backed by src/common/plan-usage-summary.ts).
 * Nothing is recomputed client-side.
 */
export function PlanUsageBars({ usage }: PlanUsageBarsProps) {
  const rows: UsageRow[] = [
    {
      key: 'contests',
      label: 'Quizzes this cycle',
      icon: Trophy,
      used: usage.contestsUsedThisCycle,
      limit: usage.limits.maxContestsPerCycle,
    },
    {
      key: 'participants',
      label: 'Participants (fullest quiz)',
      icon: Users,
      used: usage.maxParticipantsInAContest,
      limit: usage.limits.maxParticipantsPerContest,
    },
    {
      key: 'questions',
      label: 'Questions (fullest quiz)',
      icon: HelpCircle,
      used: usage.maxQuestionsInAContest,
      limit: usage.limits.maxQuestionsPerContest,
    },
    {
      key: 'members',
      label: 'Team members',
      icon: Layers,
      used: usage.memberCountUsed,
      limit: usage.limits.maxOrgMembers,
    },
  ];

  const resetLabel = usage.limits.currentPeriodEnd
    ? `Resets in ${Math.max(0, differenceInCalendarDays(new Date(usage.limits.currentPeriodEnd), new Date()))} days (${format(new Date(usage.limits.currentPeriodEnd), 'MMM d')})`
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Usage this cycle</h4>
        {resetLabel && <span className="text-xs text-muted-foreground">{resetLabel}</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map((row) => {
          const Icon = row.icon;
          const limit = row.limit;
          const isUnlimited = limit === null;
          const percent = limit === null ? 0 : Math.min(100, Math.round((row.used / limit) * 100));
          const barColor = percent >= 100 ? 'bg-destructive' : percent >= 75 ? 'bg-amber-500' : 'bg-primary';

          return (
            <div key={row.key} className="p-3 rounded-lg border border-border/50 bg-secondary/20 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {row.label}
                </span>
                <span className="font-semibold text-foreground">
                  {row.used} / {isUnlimited ? 'Unlimited' : row.limit}
                </span>
              </div>
              {!isUnlimited && (
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${percent}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlanUsageBars;
