'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { generateCampaignPhases, DEFAULT_PHASE_TEMPLATE } from '../../campaign-timeline';
import { RepeatingRowTable, type RepeatingRowColumn } from '../../RepeatingRowTable';
import type { FieldErrorMap } from '../../campaign-schema';
import type { CampaignPhaseTemplateEntry } from '@/lib/types/ambassador';
import type { Contest } from '@/lib/types';

const FRACTION_SUM_TOLERANCE = 0.01;

/** Row shape shown in the editor table — `fraction` (0–1, what's actually stored/sent) is
 *  presented to the admin as a percentage (0–100) so "0.125" doesn't have to be mentally
 *  translated; PHASE_TEMPLATE_COLUMNS' `percent` key is converted back to a fraction on save
 *  by percentRowsToFractionRows() below. */
interface PhaseTemplatePercentRow {
  key: string;
  label: string;
  percent: number;
}

const PHASE_TEMPLATE_COLUMNS: RepeatingRowColumn<PhaseTemplatePercentRow>[] = [
  { key: 'label', label: 'Phase', type: 'text', placeholder: 'Phase name' },
  { key: 'percent', label: '% of Duration', type: 'number', placeholder: '12.5' },
];

function toPercentRows(rows: CampaignPhaseTemplateEntry[]): PhaseTemplatePercentRow[] {
  return rows.map((r) => ({ key: r.key, label: r.label, percent: Math.round((r.fraction || 0) * 1000) / 10 }));
}

function toFractionRows(rows: PhaseTemplatePercentRow[]): CampaignPhaseTemplateEntry[] {
  return rows.map((r) => ({ key: r.key, label: r.label, fraction: (r.percent || 0) / 100 }));
}

export type CampaignStartMode = 'CONTEST_PUBLISHED' | 'CUSTOM';
export type CampaignEndMode = 'CONTEST_END' | 'CONTEST_START' | 'CUSTOM';

/** Derives the initial start/end mode from whatever's already saved — exported so
 *  CampaignWizard (which now owns this state, see below) can compute the same starting point.
 *  A brand-new campaign (no date yet) defaults to the friendly "track the contest" mode. An
 *  *existing* date is only ever classified as a contest-anchored mode when it provably matches
 *  the anchor already — if the anchor hasn't finished loading yet, that's "unknown," not "yes,"
 *  so this falls back to CUSTOM rather than risk the sync effect overwriting an already-saved
 *  custom date with a contest anchor that only *looked* absent because it hadn't loaded. */
export function inferInitialStartMode(startDate: string, startAnchor?: string): CampaignStartMode {
  return !startDate || (startAnchor && startDate === startAnchor) ? 'CONTEST_PUBLISHED' : 'CUSTOM';
}

export function inferInitialEndMode(endDate: string, endAnchorContestEnd?: string, endAnchorContestStart?: string): CampaignEndMode {
  if (!endDate) return 'CONTEST_END';
  if (endAnchorContestEnd && endDate === endAnchorContestEnd) return 'CONTEST_END';
  if (endAnchorContestStart && endDate === endAnchorContestStart) return 'CONTEST_START';
  return 'CUSTOM';
}

/**
 * Timeline step (§3.2, §6) — start/end date pickers plus a read-only preview of the
 * auto-generated phase breakdown (mirrors the backend's generateCampaignPhases, see
 * campaign-timeline.ts), so admins see exactly what will be stored before saving. Phase
 * breakdown itself is optionally customizable — most campaigns just use the 6-phase default.
 *
 * Start/end dates each offer an explicit anchor-to-the-contest option alongside a custom date,
 * the same "don't make the admin do date math" pattern as SpeedBonusEditor's start-date picker.
 * The mode itself is controlled from CampaignWizard (not owned locally) — this step unmounts
 * whenever the admin navigates away from Timeline, so the contest-anchor sync has to live
 * somewhere that stays mounted for the whole wizard session, the same fix applied to Speed
 * Bonus's campaignStartAt sync (see CampaignWizard.tsx).
 */
export function TimelineStep({
  startDate,
  endDate,
  phaseTemplate,
  contest,
  startMode,
  endMode,
  onStartModeChange,
  onEndModeChange,
  onChange,
  onPhaseTemplateChange,
  errors = {},
}: {
  startDate: string; // ISO, '' until set
  endDate: string; // ISO, '' until set
  phaseTemplate: CampaignPhaseTemplateEntry[] | null;
  /** The promoted contest, once one's been picked in the Promotion step — powers the
   *  "same as contest" start/end date options below. Undefined until a contest is selected. */
  contest?: Contest;
  startMode: CampaignStartMode;
  endMode: CampaignEndMode;
  onStartModeChange: (mode: CampaignStartMode) => void;
  onEndModeChange: (mode: CampaignEndMode) => void;
  onChange: (next: { startDate: string; endDate: string }) => void;
  onPhaseTemplateChange: (template: CampaignPhaseTemplateEntry[] | null) => void;
  errors?: FieldErrorMap;
}) {
  const [customizing, setCustomizing] = useState(!!phaseTemplate);

  // "Published" is when the contest actually became visible to registrants; a contest that's
  // still DRAFT (publishedAt: null) hasn't published yet, so fall back to its registration
  // start date — the next-best "when this contest starts being promotable" anchor.
  const startAnchor = contest?.publishedAt || contest?.registrationStartDate || undefined;
  const endAnchorContestEnd = contest?.contestEndTime || undefined;
  const endAnchorContestStart = contest?.contestStartTime || undefined;

  const start = startDate ? new Date(startDate) : undefined;
  const end = endDate ? new Date(endDate) : undefined;
  const phases = start && end ? generateCampaignPhases(start, end, phaseTemplate ?? undefined) : [];

  const fractionRows = phaseTemplate ?? DEFAULT_PHASE_TEMPLATE;
  const percentRows = toPercentRows(fractionRows);
  const fractionSum = fractionRows.reduce((sum, r) => sum + (r.fraction || 0), 0);
  const sumError = customizing && Math.abs(fractionSum - 1) > FRACTION_SUM_TOLERANCE ? `Shares add up to ${Math.round(fractionSum * 100)}% — they must sum to 100%.` : undefined;
  // Backend-returned validation errors (e.g. from PublishCampaignSchema) arrive dot-path keyed
  // as "phaseTemplate" (array-level) or "phaseTemplate.0.label" (row-level) — same convention
  // RankEditor uses in LeaderboardPrizesEditor.tsx. The client-side sum check runs first since
  // it's the far more common failure and doesn't need a round trip to surface.
  const phaseTemplateArrayError = sumError || errors.phaseTemplate;

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Campaign Start *</Label>
              <RadioGroup value={startMode} onValueChange={(v) => onStartModeChange(v as CampaignStartMode)} className="gap-2.5 pt-1">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="CONTEST_PUBLISHED" id="ts-start-published" disabled={!startAnchor} />
                  <Label htmlFor="ts-start-published" className={cn('font-normal cursor-pointer', !startAnchor && 'text-muted-foreground')}>
                    Same day the quiz is published
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="CUSTOM" id="ts-start-custom" />
                  <Label htmlFor="ts-start-custom" className="font-normal cursor-pointer">
                    Custom date
                  </Label>
                </div>
              </RadioGroup>
              {!startAnchor && (
                <p className="text-xs text-muted-foreground">
                  Select a quiz to promote in the Promotion step to use this option, or pick a custom date.
                </p>
              )}
              {startMode === 'CUSTOM' ? (
                <DatePicker
                  value={start}
                  onChange={(date) => onChange({ startDate: date?.toISOString() ?? '', endDate })}
                  className={cn(errors.startDate && 'border-destructive')}
                />
              ) : (
                start && <p className="text-xs text-muted-foreground">Resolves to {start.toLocaleDateString()}.</p>
              )}
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
            </div>

            <div className="space-y-2">
              <Label>Campaign End *</Label>
              <RadioGroup value={endMode} onValueChange={(v) => onEndModeChange(v as CampaignEndMode)} className="gap-2.5 pt-1">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="CONTEST_END" id="ts-end-end" disabled={!endAnchorContestEnd} />
                  <Label htmlFor="ts-end-end" className={cn('font-normal cursor-pointer', !endAnchorContestEnd && 'text-muted-foreground')}>
                    When the quiz ends
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="CONTEST_START" id="ts-end-start" disabled={!endAnchorContestStart} />
                  <Label htmlFor="ts-end-start" className={cn('font-normal cursor-pointer', !endAnchorContestStart && 'text-muted-foreground')}>
                    When the quiz starts
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="CUSTOM" id="ts-end-custom" />
                  <Label htmlFor="ts-end-custom" className="font-normal cursor-pointer">
                    Custom date
                  </Label>
                </div>
              </RadioGroup>
              {!endAnchorContestEnd && !endAnchorContestStart && (
                <p className="text-xs text-muted-foreground">
                  Select a quiz to promote in the Promotion step to use these options, or pick a custom date.
                </p>
              )}
              {endMode === 'CUSTOM' ? (
                <DatePicker
                  value={end}
                  onChange={(date) => onChange({ startDate, endDate: date?.toISOString() ?? '' })}
                  className={cn(errors.endDate && 'border-destructive')}
                />
              ) : (
                end && <p className="text-xs text-muted-foreground">Resolves to {end.toLocaleDateString()}.</p>
              )}
              {errors.endDate && <p className="text-xs text-destructive">{errors.endDate}</p>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The campaign is broken into phases automatically based on these dates — onboarding, early bird,
            steady push, and a final buffer before registrations close.
          </p>

          {!customizing ? (
            <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setCustomizing(true)}>
              Customize phases
            </Button>
          ) : (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <Label>Custom Phases</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCustomizing(false);
                    onPhaseTemplateChange(null);
                  }}
                >
                  Reset to default
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Give each phase a share of the total campaign duration, as a percentage — they need to add up to 100%.
                The exact dates each phase resolves to are shown live in the Phase Preview below.
              </p>
              <RepeatingRowTable
                rows={percentRows}
                columns={PHASE_TEMPLATE_COLUMNS}
                addLabel="Add phase"
                arrayError={phaseTemplateArrayError}
                getCellError={(index, key) => errors[`phaseTemplate.${index}.${key === 'percent' ? 'fraction' : String(key)}`]}
                newRow={() => ({ key: `phase_${percentRows.length + 1}`, label: '', percent: 0 })}
                onChange={(next) => onPhaseTemplateChange(toFractionRows(next))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {phases.length > 0 && (
        <Card className="border-border/50 bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Phase Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {phases.map((phase) => (
              <div key={phase.key} className="flex items-center justify-between text-sm">
                <span className="font-medium">{phase.label}</span>
                <span className="text-muted-foreground">
                  {new Date(phase.startsAt).toLocaleDateString()} – {new Date(phase.endsAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
