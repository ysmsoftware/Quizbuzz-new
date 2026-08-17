'use client';

import { useEffect, useRef } from 'react';
import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Check, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CampaignLifecycleActions } from '@/components/features/ambassador/admin/CampaignLifecycleActions';
import { substitutePlaceholders } from '@/components/features/ambassador/ShareTemplatesEditor';
import { Rupees } from '@/components/features/ambassador/Rupees';
import { cn } from '@/lib/utils';
import { leaderboardScopeKey } from '@/lib/types/ambassador';
import type {
  AmbassadorCampaignStatus,
  ApplicationReportRow,
  CampaignCapacity,
  CampaignPhase,
  LeaderboardCut,
  LeaderboardEntryResult,
  RecentlyJoinedAmbassador,
  ShareTemplates,
} from '@/lib/types/ambassador';

// shadcn's Card defaults to py-6/gap-6 — generous enough for a hero card, too generous once
// a dozen of them stack in a dense dashboard. Compact override applied to every card on this
// page: tight within/between a card's own sections.
export const CARD = 'border-border/50 py-4 gap-3';
export const TIER_BAR_COLORS = ['bg-chart-3', 'bg-chart-2', 'bg-chart-1', 'bg-warning'];

export function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : '—';
}

function initials(firstName: string, lastName: string | null) {
  return `${firstName[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

export interface TierDistributionItem {
  label: string;
  count: number;
  range?: string;
  percent: number;
}

// ─── Stat card — reused as-is in both the desktop 4-across row and the mobile 2x2 grid ────

export function StatCard({
  icon: Icon,
  label,
  value,
  context,
  progressPercent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  context?: string;
  progressPercent?: number;
}) {
  return (
    <Card className={CARD}>
      <CardContent>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>
        <p className="text-2xl font-semibold text-foreground tracking-tight tabular-nums">{value}</p>
        {context && <p className="text-[11px] text-muted-foreground mt-1">{context}</p>}
        {progressPercent !== undefined && <Progress value={progressPercent} className="h-1 mt-2" />}
      </CardContent>
    </Card>
  );
}

// ─── Timeline — shared date math, two visual treatments ────────────────────────────────────
// Desktop: horizontal segmented bar (dense, glanceable). Mobile: vertical step list (matches
// how a phone screen reads top-to-bottom, and gives each phase room for its own status label).

interface PhaseState {
  phase: CampaignPhase;
  state: 'done' | 'current' | 'upcoming';
  fillPercent: number;
}

function computePhaseTimeline(phases: CampaignPhase[]) {
  if (phases.length === 0) return null;
  const now = Date.now();
  const hasStarted = now >= new Date(phases[0]!.startsAt).getTime();
  const hasEnded = now >= new Date(phases[phases.length - 1]!.endsAt).getTime();
  const totalMs = new Date(phases[phases.length - 1]!.endsAt).getTime() - new Date(phases[0]!.startsAt).getTime();
  const dayOfCampaign = hasStarted ? Math.min(Math.ceil((now - new Date(phases[0]!.startsAt).getTime()) / 86_400_000), Math.ceil(totalMs / 86_400_000)) : 0;
  const totalDays = Math.ceil(totalMs / 86_400_000);
  const currentPhase = phases.find((p) => now >= new Date(p.startsAt).getTime() && now < new Date(p.endsAt).getTime());

  const steps: PhaseState[] = phases.map((phase) => {
    const start = new Date(phase.startsAt).getTime();
    const end = new Date(phase.endsAt).getTime();
    const state: PhaseState['state'] = now < start ? 'upcoming' : now >= end ? 'done' : 'current';
    const fillPercent = state === 'current' ? Math.min(100, Math.round(((now - start) / (end - start)) * 100)) : 0;
    return { phase, state, fillPercent };
  });

  return { hasStarted, hasEnded, dayOfCampaign, totalDays, currentPhase, steps };
}

export function DesktopPhaseTracker({ phases }: { phases: CampaignPhase[] }) {
  const timeline = computePhaseTimeline(phases);
  if (!timeline) return <p className="text-sm text-muted-foreground">Timeline not set.</p>;
  const { hasStarted, hasEnded, dayOfCampaign, totalDays, currentPhase, steps } = timeline;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1.5">
        <p className="text-xs text-muted-foreground">
          {!hasStarted
            ? "This campaign hasn't started yet."
            : hasEnded
              ? 'All phases have completed.'
              : (
                <>
                  Day {dayOfCampaign} of {totalDays}
                  {currentPhase && (
                    <>
                      {' '}— currently in <span className="font-medium text-primary">{currentPhase.label}</span>
                    </>
                  )}
                </>
              )}
        </p>
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map(({ phase, state, fillPercent }) => (
          <div key={phase.key} className="h-1 rounded-full bg-muted overflow-hidden relative">
            {state === 'done' && <div className="absolute inset-0 bg-primary" />}
            {state === 'current' && <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: `${fillPercent}%` }} />}
          </div>
        ))}
      </div>
      <div className="grid gap-1 mt-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map(({ phase, state }) => (
          <div key={phase.key} className="min-w-0">
            <p className={cn('text-[11px] font-medium leading-tight truncate', state !== 'done' && state !== 'current' && 'text-muted-foreground')}>{phase.label}</p>
            <p className="text-[10px] leading-tight text-muted-foreground truncate">{new Date(phase.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Capped-height, scrollable step list — a campaign can have 6+ phases, and showing all of
 *  them uncapped pushes everything else on the Overview tab below the fold. Auto-scrolls so
 *  the current phase sits centered (one done phase peeking above, one upcoming below) on
 *  mount; the full list is still reachable by scrolling within the card. */
export function MobilePhaseTracker({ phases }: { phases: CampaignPhase[] }) {
  const timeline = computePhaseTimeline(phases);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    const current = currentRef.current;
    if (!container || !current) return;
    container.scrollTop = current.offsetTop - container.clientHeight / 2 + current.clientHeight / 2;
  }, [phases]);

  if (!timeline) return <p className="text-sm text-muted-foreground">Timeline not set.</p>;
  const { dayOfCampaign, totalDays, steps } = timeline;

  const rangeLabel = (phase: CampaignPhase) => {
    const start = new Date(phase.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const end = new Date(phase.endsAt).toLocaleDateString(undefined, { day: 'numeric' });
    return `${start}–${end}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <CardTitle className="text-base">Timeline &amp; Phase</CardTitle>
        {totalDays > 0 && <span className="text-xs text-muted-foreground shrink-0">Day {dayOfCampaign} of {totalDays}</span>}
      </div>
      <div ref={scrollRef} className="flex flex-col max-h-60 overflow-y-auto">
        {steps.map(({ phase, state, fillPercent }, i) => (
          <div key={phase.key} ref={state === 'current' ? currentRef : undefined} className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <span
                className={cn(
                  'h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0',
                  state === 'done' && 'bg-primary border-primary text-primary-foreground',
                  state === 'current' && 'border-primary ring-4 ring-primary/15',
                  state === 'upcoming' && 'border-muted opacity-60',
                )}
              >
                {state === 'done' && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              {i < steps.length - 1 && <span className="w-0.5 flex-1 min-h-6 bg-border mt-1" />}
            </div>
            <div className={cn('min-w-0 flex-1', i < steps.length - 1 && 'pb-4')}>
              <div className="flex items-center justify-between gap-2">
                <span className={cn('text-sm font-semibold', state === 'current' && 'text-primary', state === 'upcoming' && 'text-muted-foreground font-medium')}>{phase.label}</span>
                <span className={cn('text-[10px] font-medium uppercase tracking-wide text-muted-foreground shrink-0', state === 'current' && 'text-primary font-bold')}>
                  {state === 'done' ? 'Done' : state === 'current' ? 'In progress' : 'Upcoming'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{rangeLabel(phase)}</p>
              {state === 'current' && (
                <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2.5">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${fillPercent}%` }} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Top Ambassadors ─────────────────────────────────────────────────────────────────────
// "table" (desktop, dense multi-column) vs "list" (mobile, a row per ambassador that reads
// top-to-bottom without needing horizontal scroll on a narrow screen).

export function TopAmbassadorsCard({
  rows,
  reportHref,
  variant,
}: {
  rows: ApplicationReportRow[];
  reportHref: string;
  variant: 'table' | 'list';
}) {
  return (
    <Card className={CARD}>
      <CardHeader>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ranked by registrations</p>
          <CardTitle className="text-base">Top Ambassadors</CardTitle>
        </div>
        <CardAction>
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <Link href={reportHref}>{variant === 'list' ? 'All →' : 'View full report →'}</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ambassadors have joined yet.</p>
        ) : variant === 'table' ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Ambassador</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Registrations</TableHead>
                <TableHead className="text-right">Accrued</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={row.ambassadorId}>
                  <TableCell className="text-xs font-semibold text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-primary/15 text-primary text-[11px] font-semibold flex items-center justify-center shrink-0">
                        {initials(row.firstName, row.lastName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{row.firstName} {row.lastName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{row.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.currentTierLabel ? (
                      <Badge variant="secondary" className="font-normal">{row.currentTierLabel}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No tier yet</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.registrationCount}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums"><Rupees amount={row.accruedAmount} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div>
            {rows.map((row, i) => (
              <div key={row.ambassadorId} className="flex items-center gap-3 py-3 border-b border-border/40 last:border-0 last:pb-0 first:pt-0">
                <span
                  className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0',
                    i === 0 ? 'bg-warning/25 text-warning' : i === 1 ? 'bg-chart-2/20 text-chart-2' : i === 2 ? 'bg-chart-4/25 text-chart-4' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {i + 1}
                </span>
                <div className="h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                  {initials(row.firstName, row.lastName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{row.firstName} {row.lastName}</p>
                  {row.currentTierLabel && (
                    <Badge variant="secondary" className="font-normal mt-0.5">{row.currentTierLabel}</Badge>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold tabular-nums">{row.registrationCount}</p>
                  <p className="text-[11px] font-semibold text-primary tabular-nums mt-0.5"><Rupees amount={row.accruedAmount} /></p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Milestone Reach ─────────────────────────────────────────────────────────────────────

export function MilestoneReachCard({ ambassadorCount, tierDistribution }: { ambassadorCount: number; tierDistribution: TierDistributionItem[] }) {
  return (
    <Card className={CARD}>
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{ambassadorCount} ambassadors, grouped by current tier</p>
        <CardTitle className="text-base">Milestone Reach</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {tierDistribution.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ambassadors have reached a tier yet.</p>
        ) : (
          tierDistribution.map((t, i) => (
            <div key={t.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
              <div className="min-w-0">
                <span className={cn('text-sm font-medium truncate', t.label === 'No tier yet' && 'text-muted-foreground font-normal')}>{t.label}</span>
                {t.range && <span className="ml-1.5 text-[11px] text-muted-foreground">{t.range}</span>}
              </div>
              <span className="text-sm font-semibold tabular-nums w-8 text-right">{t.count}</span>
              <div className="col-span-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full', t.label === 'No tier yet' ? 'bg-muted-foreground/40' : TIER_BAR_COLORS[i % TIER_BAR_COLORS.length])}
                  style={{ width: `${t.percent}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ─── Leaderboards ────────────────────────────────────────────────────────────────────────

export function LeaderboardsCard({
  cuts,
  activeCutIndex,
  onSelectCut,
  previewRows,
  onManage,
}: {
  cuts: LeaderboardCut[];
  activeCutIndex: number;
  onSelectCut: (index: number) => void;
  previewRows: LeaderboardEntryResult[];
  onManage: () => void;
}) {
  const activeCut = cuts[activeCutIndex] ?? cuts[0];
  return (
    <Card className={CARD}>
      <CardHeader>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{cuts.length} leaderboard{cuts.length === 1 ? '' : 's'} configured</p>
          <CardTitle className="text-base">Leaderboards</CardTitle>
        </div>
        <CardAction>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={onManage}>Manage →</Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {cuts.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {cuts.map((cut, i) => (
              <button
                key={leaderboardScopeKey(cut.scope)}
                type="button"
                onClick={() => onSelectCut(i)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  i === activeCutIndex ? 'bg-primary text-primary-foreground border-transparent' : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {cut.label}
              </button>
            ))}
          </div>
        )}
        {previewRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rankings yet for {activeCut?.label}.</p>
        ) : (
          <div className="space-y-1">
            {previewRows.map((row) => (
              <div key={row.groupKey} className="flex items-center gap-3 py-1.5 border-b border-border/40 last:border-0">
                <div className={cn('h-5.5 w-5.5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0', row.rank === 1 ? 'bg-warning/25 text-warning' : 'bg-muted text-muted-foreground')}>
                  {row.rank}
                </div>
                <span className="text-sm font-medium flex-1 truncate">{row.label}</span>
                <span className="text-xs text-muted-foreground">{row.registrationCount} regs</span>
                {row.prize && (
                  <span className="text-xs font-semibold text-primary min-w-[56px] text-right">
                    {row.prize.cashAmount ? <Rupees amount={row.prize.cashAmount} /> : row.prize.label ?? row.prize.goodie?.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Ambassador Kit ──────────────────────────────────────────────────────────────────────

export function AmbassadorKitCard({
  shareTemplates,
  whatsappTemplates,
  primaryTemplate,
  contestTitle,
  onEdit,
}: {
  shareTemplates: ShareTemplates;
  whatsappTemplates: { label: string; text: string }[];
  primaryTemplate: { label: string; text: string } | undefined;
  contestTitle: string | undefined;
  onEdit: () => void;
}) {
  return (
    <Card className={CARD}>
      <CardHeader>
        <CardTitle className="text-base">Ambassador Kit</CardTitle>
        <CardAction>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={onEdit}>Edit →</Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[96px_1fr] gap-3">
          {shareTemplates.posterImageUrl ? (
            <img src={shareTemplates.posterImageUrl} alt="Campaign poster" className="w-full aspect-square object-cover rounded-lg border border-border/50" />
          ) : (
            <div className="w-full aspect-square rounded-lg border border-dashed border-border flex items-center justify-center">
              <p className="text-[10px] text-muted-foreground text-center px-1">No poster</p>
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <div className="flex items-center justify-between py-1 text-sm border-b border-border/40">
              <span className="text-muted-foreground">WhatsApp templates</span>
              <span className="font-medium">{whatsappTemplates.length ? `${whatsappTemplates.length} active` : '—'}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-muted-foreground">Instagram caption</span>
              <span className="font-medium">{shareTemplates.instagramText ? 'Set' : '—'}</span>
            </div>
          </div>
        </div>
        {primaryTemplate && (
          <div className="mt-2.5 rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{primaryTemplate.label} · sample preview</p>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed line-clamp-4">{substitutePlaceholders(primaryTemplate.text, contestTitle)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Recently Joined ─────────────────────────────────────────────────────────────────────

export function RecentlyJoinedCard({ rows }: { rows: RecentlyJoinedAmbassador[] }) {
  if (rows.length === 0) return null;
  return (
    <Card className={CARD}>
      <CardHeader>
        <CardTitle className="text-base">Recently Joined</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.map((row) => (
          <div key={row.ambassadorId} className="flex gap-2.5 py-1.5 border-b border-border/40 last:border-0">
            <Trophy className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-foreground truncate">
                <span className="font-semibold">{row.firstName} {row.lastName}</span> joined as an ambassador
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Reward Budget ───────────────────────────────────────────────────────────────────────

export function RewardBudgetCard({
  leaderboardBudget,
  speedBonusBudget,
  totalBudget,
}: {
  leaderboardBudget: number;
  speedBonusBudget: number;
  totalBudget: number;
}) {
  if (totalBudget <= 0) return null;
  const leaderboardBudgetPercent = totalBudget > 0 ? Math.round((leaderboardBudget / totalBudget) * 100) : 0;

  return (
    <Card className={CARD}>
      <CardHeader>
        <CardTitle className="text-base">Reward Budget</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <svg width="72" height="72" viewBox="0 0 42 42" className="shrink-0 -rotate-90">
            <circle cx="21" cy="21" r="15.9" fill="transparent" strokeWidth="6" className="stroke-muted" />
            {leaderboardBudget > 0 && (
              <circle cx="21" cy="21" r="15.9" fill="transparent" strokeWidth="6" strokeDasharray={`${leaderboardBudgetPercent} ${100 - leaderboardBudgetPercent}`} className="stroke-chart-1" />
            )}
            {speedBonusBudget > 0 && (
              <circle
                cx="21" cy="21" r="15.9" fill="transparent" strokeWidth="6"
                strokeDasharray={`${100 - leaderboardBudgetPercent} ${leaderboardBudgetPercent}`}
                strokeDashoffset={-leaderboardBudgetPercent}
                className="stroke-chart-4"
              />
            )}
          </svg>
          <div className="flex-1 space-y-2 text-sm min-w-0">
            {leaderboardBudget > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-muted-foreground truncate"><span className="h-2 w-2 rounded-sm bg-chart-1 shrink-0" />Leaderboard prizes</span>
                <span className="font-medium tabular-nums shrink-0"><Rupees amount={leaderboardBudget} /></span>
              </div>
            )}
            {speedBonusBudget > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-muted-foreground truncate"><span className="h-2 w-2 rounded-sm bg-chart-4 shrink-0" />Speed bonus</span>
                <span className="font-medium tabular-nums shrink-0"><Rupees amount={speedBonusBudget} /></span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-baseline justify-between mt-3 pt-3 border-t border-border/40">
          <span className="text-xs text-muted-foreground">Estimated total</span>
          <span className="text-lg font-bold tabular-nums"><Rupees amount={totalBudget} /></span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Ambassador Structure ────────────────────────────────────────────────────────────────

export function AmbassadorStructureCard({ capacity, ambassadorCount }: { capacity: CampaignCapacity; ambassadorCount: number }) {
  return (
    <Card className={CARD}>
      <CardHeader>
        <CardTitle className="text-base">Ambassador Structure</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between py-0.5 text-sm">
          <span className="text-muted-foreground">Groups</span>
          <span className="font-semibold">{capacity.groupCount || '—'}</span>
        </div>
        <div className="flex items-center justify-between py-0.5 text-sm">
          <span className="text-muted-foreground">Ambassador target</span>
          <span className="font-semibold tabular-nums">{capacity.totalAmbassadorTarget ? capacity.totalAmbassadorTarget.toLocaleString() : '—'}</span>
        </div>
        <div className="flex items-center justify-between py-0.5 text-sm">
          <span className="text-muted-foreground">Registration target</span>
          <span className="font-semibold tabular-nums">{capacity.totalRegistrationTarget ? capacity.totalRegistrationTarget.toLocaleString() : '—'}</span>
        </div>
        {capacity.totalAmbassadorTarget > 0 && <Progress value={Math.min(100, (ambassadorCount / capacity.totalAmbassadorTarget) * 100)} className="h-1 mt-2" />}
      </CardContent>
    </Card>
  );
}

// ─── Record ──────────────────────────────────────────────────────────────────────────────

export function RecordCard({
  campaignId,
  status,
  publishedAt,
  updatedAt,
}: {
  campaignId: string;
  status: AmbassadorCampaignStatus;
  publishedAt: string | null;
  updatedAt: string;
}) {
  return (
    <Card className={CARD}>
      <CardHeader>
        <CardTitle className="text-base">Record</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between py-0.5 text-sm">
          <span className="text-muted-foreground">Published</span>
          <span className="font-medium">{formatDate(publishedAt)}</span>
        </div>
        <div className="flex items-center justify-between py-0.5 text-sm">
          <span className="text-muted-foreground">Last updated</span>
          <span className="font-medium">{formatDate(updatedAt)}</span>
        </div>
        {status !== 'ARCHIVED' ? (
          <div className="mt-2.5 pt-2.5 border-t border-border/40">
            <CampaignLifecycleActions campaignId={campaignId} status={status} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-2.5 pt-2.5 border-t border-border/40">This campaign is archived — no further actions are available.</p>
        )}
      </CardContent>
    </Card>
  );
}
