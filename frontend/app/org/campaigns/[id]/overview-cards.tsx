'use client';

import { useEffect, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Check, ChevronRight, Eye, FileText, MessageSquare, Paperclip, Plus, Sparkles, Trophy, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CampaignLifecycleActions } from '@/components/features/ambassador/admin/CampaignLifecycleActions';
import { substitutePlaceholders } from '@/components/features/ambassador/ShareTemplatesEditor';
import { ViewKitModal } from '@/components/features/ambassador/admin/ViewKitModal';
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
  ShareKit,
  ShareTemplates,
  SpeedBonusConfig,
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
  onSelectAmbassador,
}: {
  rows: ApplicationReportRow[];
  reportHref: string;
  variant: 'table' | 'list';
  /** Opens the referral drill-down (ReferralListDialog) for one row — omit to leave rows
   *  non-interactive (registrationCount is display-only without it). */
  onSelectAmbassador?: (row: ApplicationReportRow) => void;
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
                <TableRow
                  key={row.ambassadorId}
                  className={onSelectAmbassador ? 'cursor-pointer hover:bg-muted/40' : undefined}
                  onClick={onSelectAmbassador ? () => onSelectAmbassador(row) : undefined}
                >
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
                  <TableCell className={cn('text-right tabular-nums', onSelectAmbassador && 'underline-offset-2 hover:underline')}>
                    {row.registrationCount}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums"><Rupees amount={row.accruedAmount} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div>
            {rows.map((row, i) => (
              <div
                key={row.ambassadorId}
                role={onSelectAmbassador ? 'button' : undefined}
                tabIndex={onSelectAmbassador ? 0 : undefined}
                onClick={onSelectAmbassador ? () => onSelectAmbassador(row) : undefined}
                onKeyDown={onSelectAmbassador ? (e) => (e.key === 'Enter' || e.key === ' ') && onSelectAmbassador(row) : undefined}
                className={cn(
                  'flex items-center gap-3 py-3 border-b border-border/40 last:border-0 last:pb-0 first:pt-0',
                  onSelectAmbassador && 'cursor-pointer -mx-2 px-2 rounded-lg hover:bg-muted/40',
                )}
              >
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
  contestTitle,
  onEdit,
}: {
  shareTemplates: ShareTemplates;
  whatsappTemplates?: { label: string; text: string }[];
  primaryTemplate?: { label: string; text: string } | undefined;
  contestTitle: string | undefined;
  onEdit: () => void;
}) {
  const [selectedKit, setSelectedKit] = useState<ShareKit | null>(null);

  const kits: ShareKit[] = shareTemplates.kits?.length
    ? shareTemplates.kits
    : [
        {
          id: 'primary-kit',
          name: 'Primary Share Kit',
          description: 'Default sharing assets',
          templateText:
            shareTemplates.whatsappText ||
            shareTemplates.whatsappTemplates?.[0]?.text ||
            '',
          posterImageUrl: shareTemplates.posterImageUrl,
          assets: [],
        },
      ].filter((k) => k.templateText || k.posterImageUrl);

  return (
    <>
      <Card className={CARD}>
        <CardHeader>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {kits.length} kit{kits.length === 1 ? '' : 's'} configured
            </p>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Ambassador Kits &amp; Resources
            </CardTitle>
          </div>
          <CardAction className="flex items-center gap-2">
            <Button variant="link" size="sm" className="h-auto p-0" onClick={onEdit}>
              Edit Kits →
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-3">
          {kits.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No share kits configured yet.</p>
          ) : (
            kits.map((kit) => (
              <div
                key={kit.id}
                onClick={() => setSelectedKit(kit)}
                className="group relative rounded-xl border border-border/60 hover:border-primary/40 bg-card hover:bg-muted/40 p-4 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                {/* Left section: Poster thumbnail / Icon & Title */}
                <div className="flex items-center gap-3.5 min-w-0">
                  {kit.posterImageUrl ? (
                    <img
                      src={kit.posterImageUrl}
                      alt={kit.name}
                      className="w-14 h-14 rounded-lg border border-border/50 object-cover shrink-0 bg-muted group-hover:scale-105 transition-transform duration-200 shadow-2xs"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary group-hover:bg-primary/20 transition-colors">
                      <Sparkles className="h-5 w-5" />
                    </div>
                  )}

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                        {kit.name}
                      </h4>
                      {kit.templateText && (
                        <Badge variant="secondary" className="text-[10px] font-medium py-0 px-1.5 bg-primary/10 text-primary border-primary/20">
                          Message Ready
                        </Badge>
                      )}
                    </div>
                    {kit.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                        {kit.description}
                      </p>
                    ) : kit.templateText ? (
                      <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed font-sans">
                        {substitutePlaceholders(kit.templateText, contestTitle)}
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2 pt-0.5 text-[11px] text-muted-foreground flex-wrap">
                      {kit.posterImageUrl && (
                        <span className="flex items-center gap-1 font-medium">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          Poster graphic included
                        </span>
                      )}
                      {kit.assets && kit.assets.length > 0 && (
                        <span className="flex items-center gap-1 font-medium">
                          <Paperclip className="h-3 w-3 text-muted-foreground" />
                          {kit.assets.length} {kit.assets.length === 1 ? 'file attached' : 'files attached'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right section: View Kit button */}
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-medium group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedKit(kit);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    View Kit
                    <ChevronRight className="h-3.5 w-3.5 ml-0.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </div>
              </div>
            ))
          )}

          <Button type="button" variant="outline" size="sm" className="w-full text-xs border-dashed" onClick={onEdit}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add / Manage Share Kits
          </Button>
        </CardContent>
      </Card>

      <ViewKitModal
        kit={selectedKit}
        open={!!selectedKit}
        onOpenChange={(open) => !open && setSelectedKit(null)}
        contestTitle={contestTitle}
        onEdit={onEdit}
      />
    </>
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

// ─── Speed Bonus config (read-only) ──────────────────────────────────────────────────────
// RewardBudgetCard above only ever surfaces the lump speedBonusBudget rupee total (and
// disappears entirely if that total is 0) — this shows the actual configuration an admin set
// at creation time (enabled state, qualifying window, per-tier breakdown), which was
// previously visible only by opening the Rewards edit panel.

export function SpeedBonusConfigCard({
  speedBonus,
  earnedTierWithinDays,
}: {
  speedBonus: SpeedBonusConfig | undefined;
  /** Ambassador-side only — highlights the tier this viewer already earned (stats.speedBonus.tier.withinDays).
   *  Undefined on the org-admin read of this same card, where there's no single viewer to earn anything. */
  earnedTierWithinDays?: number;
}) {
  if (!speedBonus) return null;

  return (
    <Card className={CARD}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-warning" />
          Speed Bonus
        </CardTitle>
        <CardAction>
          <Badge variant={speedBonus.enabled ? 'default' : 'outline'}>{speedBonus.enabled ? 'Enabled' : 'Disabled'}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Qualifying window starts</span>
          <span className="font-medium text-foreground">{speedBonus.campaignStartAt ? formatDate(speedBonus.campaignStartAt) : '—'}</span>
        </div>
        {speedBonus.milestoneThreshold !== undefined && (
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Registrations needed</span>
            <span className="font-medium text-foreground">{speedBonus.milestoneThreshold}</span>
          </div>
        )}
        {speedBonus.tiers.length > 0 && (
          <div className="pt-2 border-t border-border/40 space-y-2">
            {speedBonus.tiers.map((t, i) => {
              const earned = earnedTierWithinDays === t.withinDays;
              return (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className={cn('truncate', earned ? 'font-semibold text-warning' : 'text-muted-foreground')}>
                    {t.label} · within {t.withinDays} {t.withinDays === 1 ? 'day' : 'days'}
                    {t.maxWinners ? ` · up to ${t.maxWinners} winners` : ''}
                    {earned ? ' · Earned' : ''}
                  </span>
                  <span className={cn('font-medium tabular-nums shrink-0', earned && 'text-warning')}><Rupees amount={t.bonusAmount} /></span>
                </div>
              );
            })}
          </div>
        )}
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
