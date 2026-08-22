'use client';

import { GraduationCap } from 'lucide-react';
import { usePlatformAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { AmbassadorAvatar } from './AmbassadorAvatar';
import type { Ambassador } from '@/lib/types/ambassador';

interface IdentityHeroProps {
  ambassador: Ambassador;
  activeCampaigns: number;
  totalRegistrations: number;
  bestRank: { rank: number; of: number } | null;
}

/** The hub's identity strip — who you are (with your ambassador type, since this program
 *  serves both students and faculty and the two should read differently at a glance), and
 *  the three numbers that matter across every campaign, not just one. */
export function IdentityHero({ ambassador, activeCampaigns, totalRegistrations, bestRank }: IdentityHeroProps) {
  // Ambassador is a platform identity, not org-scoped — ambassadorType is a free-form key
  // resolved against the platform-wide catalog for a human label (see ambassador-types.ts).
  const { types } = usePlatformAmbassadorTypes();
  const typeLabel = types.find((t) => t.key === ambassador.ambassadorType)?.label ?? ambassador.ambassadorType;
  const memberSince = new Date(ambassador.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 sm:p-7 mb-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(420px 220px at 10% -20%, color-mix(in oklch, var(--primary) 18%, transparent), transparent), radial-gradient(340px 200px at 95% 130%, color-mix(in oklch, var(--accent) 28%, transparent), transparent)',
        }}
      />
      <div className="relative flex flex-wrap items-center gap-5">
        <AmbassadorAvatar
          firstName={ambassador.firstName}
          lastName={ambassador.lastName}
          profileImageUrl={ambassador.profileImageUrl}
          size={64}
          className="shadow-lg shadow-primary/20"
        />

        <div className="min-w-[200px] flex-1">
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-foreground">
              {ambassador.firstName} {ambassador.lastName}
            </h1>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 bg-primary/12 text-primary">
              <GraduationCap className="h-3 w-3" />
              {typeLabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Ambassador since {memberSince}</p>
        </div>

        <div className="flex gap-6 sm:gap-8 flex-wrap">
          <IdentityStat label="Active campaigns" value={activeCampaigns} />
          <IdentityStat label="Registrations" value={totalRegistrations} />
          <IdentityStat label="Best rank" value={bestRank ? `#${bestRank.rank}` : '—'} unit={bestRank ? `of ${bestRank.of}` : undefined} />
        </div>
      </div>
    </div>
  );
}

function IdentityStat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
      <p className="text-xl font-bold text-foreground tabular-nums">
        {value}
        {unit && <span className="text-xs font-medium text-muted-foreground ml-1.5">{unit}</span>}
      </p>
    </div>
  );
}
