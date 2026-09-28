'use client';

import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Rupees } from '@/components/features/ambassador/Rupees';
import type { CampaignReportSummary } from '@/lib/types/ambassador';
import { cn } from '@/lib/utils';

/**
 * Report-page-only cards — each shows something the campaign detail page doesn't (referral
 * quality, payout liability by source, the non-approved applications), all from the one
 * GET /report/summary response.
 */

type SummaryProps = { summary: CampaignReportSummary | undefined };

function Panel({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, context }: { label: string; value: React.ReactNode; context?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2.5 min-w-0">
      <div className="text-xs text-muted-foreground truncate">{label}</div>
      <div className="text-lg font-semibold tabular-nums leading-tight mt-0.5">{value}</div>
      {context && <div className="text-[11px] text-muted-foreground truncate">{context}</div>}
    </div>
  );
}

export function ReportSummaryStrip({ summary, periodActive }: SummaryProps & { periodActive: boolean }) {
  if (!summary) return <Skeleton className="h-[74px] w-full rounded-lg" />;
  const { period, liability, allTimePaid, approvedAmbassadors } = summary;
  const costPerPaid = allTimePaid > 0 ? liability.total / allTimePaid : null;
  const periodLabel = periodActive ? 'in period' : 'all time';
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Stat label={`Referred registrations · ${periodLabel}`} value={period.registrations} />
      <Stat label={`Paid registrations · ${periodLabel}`} value={period.paid} context={<Rupees amount={period.revenue} />} />
      <Stat label="Cost per paid registration" value={costPerPaid === null ? '—' : <Rupees amount={costPerPaid} />} context="All-time payout ÷ paid" />
      <Stat label={`Active ambassadors · ${periodLabel}`} value={period.activeAmbassadors} context={`of ${approvedAmbassadors} approved`} />
    </div>
  );
}

function LiabilityRow({ label, detail, amount, strong }: { label: string; detail?: string; amount: number; strong?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 text-sm', strong && 'font-semibold border-t border-border/50 pt-2')}>
      <span className="min-w-0">
        <span className={strong ? undefined : 'text-muted-foreground'}>{label}</span>
        {detail && <span className="block text-[11px] text-muted-foreground">{detail}</span>}
      </span>
      <Rupees amount={amount} className="tabular-nums shrink-0" />
    </div>
  );
}

export function PayoutLiabilityCard({ summary }: SummaryProps) {
  if (!summary) return <Skeleton className="h-48 w-full rounded-xl" />;
  const l = summary.liability;
  const pct = l.budget > 0 ? Math.min(100, Math.round((l.total / l.budget) * 100)) : null;
  return (
    <Panel title="Payout liability" aside="If the campaign ended now">
      <div className="space-y-2">
        <LiabilityRow label="Milestone tiers" detail={`${l.milestoneReached} ambassador${l.milestoneReached === 1 ? '' : 's'} reached a tier`} amount={l.milestoneAmount} />
        <LiabilityRow label="Speed bonus" detail={`${l.speedBonusWinners} winner${l.speedBonusWinners === 1 ? '' : 's'}`} amount={l.speedBonusAmount} />
        {l.leaderboardCuts.length > 0 ? (
          l.leaderboardCuts.map((c) => (
            <LiabilityRow key={c.label} label={`${c.label} prizes`} detail={`Projected · ${c.rankedGroups} placed`} amount={c.projected} />
          ))
        ) : (
          <LiabilityRow label="Leaderboard prizes" amount={0} />
        )}
        <LiabilityRow label="Total" amount={l.total} strong />
      </div>
      {pct !== null && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {pct}% of <Rupees amount={l.budget} />{' '}prize budget · milestones aren&apos;t budgeted
          </p>
        </div>
      )}
    </Panel>
  );
}

export function ReferralQualityCard({ summary, periodActive }: SummaryProps & { periodActive: boolean }) {
  if (!summary) return <Skeleton className="h-36 w-full rounded-xl" />;
  const { registrations, paid, attended, disqualified } = summary.period;
  const steps = [
    { label: 'Registered', value: registrations },
    { label: 'Paid', value: paid },
    { label: 'Attended', value: attended },
    { label: 'Disqualified', value: disqualified },
  ];
  return (
    <Panel title="Referral quality" aside={periodActive ? 'Selected period' : 'All time'}>
      <div className="space-y-2">
        {steps.map((s) => (
          <div key={s.label} className="grid grid-cols-[84px_minmax(0,1fr)_32px] items-center gap-2 text-sm">
            <span className="text-muted-foreground text-xs">{s.label}</span>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full', s.label === 'Disqualified' ? 'bg-destructive/70' : 'bg-primary')}
                style={{ width: `${registrations > 0 ? Math.round((s.value / registrations) * 100) : 0}%` }}
              />
            </div>
            <span className="text-right tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Attendance fills in once the contest runs.</p>
    </Panel>
  );
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

export function ApplicationsCard({ summary }: SummaryProps) {
  if (!summary) return <Skeleton className="h-36 w-full rounded-xl" />;
  const a = summary.applications;
  return (
    <Panel title="Applications" aside={`${a.approved} approved · ${a.pending} pending · ${a.rejected} rejected`}>
      {a.recent.length === 0 ? (
        <p className="text-xs text-muted-foreground">No pending or rejected applications.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {a.recent.map((r) => (
            <li key={r.enrollmentId} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{r.firstName} {r.lastName}</span>
                <span className="block text-[11px] text-muted-foreground truncate">
                  {r.status === 'REJECTED' && r.rejectionReason ? r.rejectionReason : `Applied ${format(new Date(r.appliedAt), 'd MMM')}`}
                </span>
              </span>
              <Badge variant="outline" className={cn('border-transparent capitalize', STATUS_STYLE[r.status])}>
                {r.status.toLowerCase()}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
