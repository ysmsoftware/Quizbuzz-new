'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LeaderboardEntryResult, MilestoneTier } from '@/lib/types/ambassador';

interface ChartRow {
  rank: number;
  label: string;
  registrationCount: number;
  isYou: boolean;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartRow }> }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-popover-foreground truncate max-w-[160px]">
        {row.label}
        {row.isYou && <span className="text-primary"> (You)</span>}
      </p>
      <p className="text-xs text-muted-foreground">
        {row.registrationCount} registration{row.registrationCount === 1 ? '' : 's'}
      </p>
    </div>
  );
}

interface LeaderboardChartProps {
  /** Sorted by rank ascending (page 1 of the leaderboard). */
  rows: LeaderboardEntryResult[];
  /** This ambassador's own rank within this exact scope, if any — highlights that bar. */
  ownRank: number | null;
  /** Reward-tier thresholds to render as Y-axis ticks instead of raw numbers (e.g. "Level-2"
   *  at the 40-registration line) — pass only for the scope milestone tiers actually apply
   *  to (individual ambassador); omit for a group/department cut, where they don't mean
   *  anything (rewards pay individual ambassadors, not groups). */
  tierTicks?: MilestoneTier[];
}

/** Bar chart for one leaderboard cut — x-axis is rank ("You" for the ambassador's own bar),
 *  y-axis is registration count. When tierTicks is given, the y-axis ticks are swapped for
 *  the milestone-tier thresholds so you can read straight off the chart which tier a given
 *  position corresponds to, instead of just a raw registration count. */
export function LeaderboardChart({ rows, ownRank, tierTicks }: LeaderboardChartProps) {
  if (rows.length === 0) return null;

  const data: ChartRow[] = rows.map((r) => ({
    rank: r.rank,
    label: r.label,
    registrationCount: r.registrationCount,
    isYou: ownRank !== null && r.rank === ownRank,
  }));

  const yTicks = tierTicks?.length
    ? Array.from(new Set([0, ...tierTicks.map((t) => t.minRegistrations)])).sort((a, b) => a - b)
    : undefined;
  const tierLabelByThreshold = new Map(tierTicks?.map((t, i) => [t.minRegistrations, t.label ?? `Tier ${i + 1}`]));
  const yTickFormatter = (value: number) => tierLabelByThreshold.get(value) ?? String(value);

  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 6, left: 0, bottom: 0 }} barCategoryGap="24%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="rank"
            tickFormatter={(rank: number) => (ownRank !== null && rank === ownRank ? 'You' : `#${rank}`)}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            width={yTicks ? 56 : 30}
            ticks={yTicks}
            tickFormatter={yTicks ? yTickFormatter : undefined}
            tick={{ fontSize: 9.5, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)' }} />
          <Bar dataKey="registrationCount" radius={[5, 5, 2, 2]} maxBarSize={34}>
            {data.map((d) => (
              <Cell key={d.rank} fill={d.isYou ? 'var(--primary)' : 'var(--muted-foreground)'} fillOpacity={d.isYou ? 1 : 0.3} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
