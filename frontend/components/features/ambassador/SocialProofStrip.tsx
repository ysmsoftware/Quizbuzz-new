'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { useAmbassadorCampaignSocialProof } from '@/lib/hooks/useAmbassadorCampaignStats';

const AVATAR_GRADIENTS = [
  'from-chart-1 to-chart-2',
  'from-chart-3 to-chart-1',
  'from-accent to-chart-4',
  'from-chart-2 to-chart-5',
  'from-chart-4 to-chart-1',
];

function initials(firstName: string, lastName: string | null) {
  return `${firstName.charAt(0)}${lastName?.charAt(0) ?? ''}`.toUpperCase();
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.round(diffMs / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

/** Cross-ambassador social proof for one campaign — who else recently joined, and the tier
 *  mix across everyone approved. Backed by GET /ambassador/campaigns/:id/social-proof, a
 *  new endpoint reusing the same aggregate the org-admin dashboard already computes. */
export function SocialProofStrip({ campaignId }: { campaignId: string }) {
  const { summary, isLoading } = useAmbassadorCampaignSocialProof(campaignId);

  if (isLoading) return <Skeleton className="h-[68px] w-full rounded-xl" />;
  if (!summary || summary.ambassadorCount === 0) return null;

  const tierCounts = summary.tierCounts.filter((t) => t.count > 0);
  const totalForMix = tierCounts.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/50 bg-card shadow-sm px-5 py-4">
      {summary.recentlyJoined.length > 0 && (
        <div className="flex -space-x-2.5 shrink-0">
          {summary.recentlyJoined.slice(0, 5).map((a, i) => (
            <div
              key={a.ambassadorId}
              title={`${a.firstName} ${a.lastName ?? ''} · joined ${relativeTime(a.createdAt)}`}
              className={`h-8 w-8 rounded-full border-2 border-card bg-gradient-to-br ${AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]} text-white text-[11px] font-bold flex items-center justify-center`}
            >
              {initials(a.firstName, a.lastName)}
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-foreground shrink-0">
        <span className="font-bold tabular-nums">{summary.ambassadorCount}</span> ambassador{summary.ambassadorCount === 1 ? '' : 's'} on this
        campaign
        {summary.recentlyJoined[0] && <span className="text-muted-foreground"> · last joined {relativeTime(summary.recentlyJoined[0].createdAt)}</span>}
      </p>

      {totalForMix > 0 && (
        <>
          <div className="hidden sm:block w-px h-6 bg-border" />
          <div className="flex items-center gap-2.5 flex-1 min-w-[140px]">
            <span className="text-xs text-muted-foreground shrink-0">Tier mix</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden flex bg-secondary min-w-[80px]">
              {tierCounts.map((t, i) => (
                <span
                  key={t.label}
                  style={{ width: `${(t.count / totalForMix) * 100}%` }}
                  className={i % 2 === 0 ? 'bg-chart-1' : 'bg-chart-2'}
                  title={`${t.label}: ${t.count}`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
