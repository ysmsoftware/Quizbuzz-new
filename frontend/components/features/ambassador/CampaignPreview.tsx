'use client';

import Link from 'next/link';
import { ArrowLeft, Clock, Lock, UserPlus, XCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePlatformAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { CampaignTimelineStrip } from './CampaignTimelineStrip';
import { RewardTiersCard } from './RewardTiersCard';
import { CampaignLeaderboardCard } from './CampaignLeaderboardCard';
import { Rupees } from './Rupees';
import { leaderboardScopeKey } from '@/lib/types/ambassador';
import type { AvailableCampaignItem } from '@/lib/types/ambassador';

interface CampaignPreviewProps {
  campaignId: string;
  preview: AvailableCampaignItem;
  /** Highlights this ambassador's own bar in a leaderboard chart, when logged in and already
   *  ranked somewhere — harmless to omit for a logged-out viewer. */
  ambassadorId?: string;
  hasApplied: boolean;
  applying: boolean;
  applicationStatus?: 'PENDING' | 'REJECTED';
  rejectionReason?: string | null;
  onApply: () => void;
  backHref?: string;
  backLabel?: string;
}

/**
 * The full campaign-detail layout (timeline, reward ladder, leaderboards + prize schedules,
 * ambassador kit) rendered for someone who isn't an APPROVED ambassador on this campaign yet —
 * everything sourced from the public-safe preview slice (AvailableCampaignItem), with an Apply
 * CTA instead of the referral/share tools. Shared by the authenticated "available campaigns"
 * detail page and the public, no-login campaign link — same page, not a forked copy, so reward
 * changes only ever need updating in one place.
 */
export function CampaignPreview({
  campaignId,
  preview,
  ambassadorId,
  hasApplied,
  applying,
  applicationStatus,
  rejectionReason,
  onApply,
  backHref,
  backLabel,
}: CampaignPreviewProps) {
  const { types: platformTypes } = usePlatformAmbassadorTypes();
  const typeLabel = (key: string) => platformTypes.find((t) => t.key === key)?.label ?? key;

  const milestoneTiers = preview.rewardConfig.milestoneTiers ?? [];
  const leaderboardCuts = preview.rewardConfig.leaderboardPrizes ?? [];
  const speedBonusTiers = preview.rewardConfig.speedBonus?.enabled ? preview.rewardConfig.speedBonus.tiers : [];

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {backHref && (
          <Button variant="ghost" size="sm" className="-ml-2" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {backLabel ?? 'Back'}
            </Link>
          </Button>
        )}

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-foreground">{preview.name}</h1>
              {preview.status === 'LIVE' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-success bg-success/10 rounded-full px-2.5 py-1 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Live
                </span>
              )}
              {applicationStatus === 'PENDING' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground bg-secondary rounded-full px-2.5 py-1 shrink-0">
                  <Clock className="h-3 w-3" />
                  Pending review
                </span>
              )}
              {applicationStatus === 'REJECTED' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-destructive bg-destructive/10 rounded-full px-2.5 py-1 shrink-0">
                  <XCircle className="h-3 w-3" />
                  Not approved
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
              {(preview.organizationName || preview.contestTitle) && (
                <span>{[preview.organizationName, preview.contestTitle].filter(Boolean).join(' · ')}</span>
              )}
              {preview.ambassadorTypesAllowed.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/60">·</span>
                  open to
                  {preview.ambassadorTypesAllowed.map((key) => (
                    <span key={key} className="text-[11px] font-semibold bg-primary/10 text-primary rounded-full px-2 py-0.5">
                      {typeLabel(key)}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!hasApplied && (
              <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" disabled={applying} onClick={onApply}>
                <UserPlus className="h-4 w-4" />
                {applying ? 'Applying…' : 'Apply to this campaign'}
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground max-w-[70ch]">
          {preview.organizationName} is recruiting {preview.ambassadorTypesAllowed.map(typeLabel).join(', ') || 'ambassadors'} to help
          promote {preview.contestTitle}. Below is exactly what applying pays, and how the campaign is timed.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_344px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <section className="space-y-3">
              <h2 className="text-[17px] font-bold text-foreground">What you&apos;re promoting</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="border-border/50">
                  <CardContent className="pt-5 pb-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contest</p>
                    <p className="text-lg font-bold text-foreground mt-1">{preview.contestTitle}</p>
                    <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                      <div>
                        <p className="text-muted-foreground">Duration</p>
                        <p className="font-semibold text-foreground mt-0.5">{preview.contestDurationMinutes} minutes</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Starts</p>
                        <p className="font-semibold text-foreground mt-0.5">
                          {new Date(preview.contestStartTime).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Registration closes</p>
                        <p className="font-semibold text-foreground mt-0.5">
                          {new Date(preview.contestRegistrationDeadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      {preview.contestPassingScore !== null && (
                        <div>
                          <p className="text-muted-foreground">Passing score</p>
                          <p className="font-semibold text-foreground mt-0.5">{preview.contestPassingScore}%</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50 border-l-4 border-l-primary">
                  <CardContent className="pt-5 pb-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Eligibility</p>
                    <p className="text-sm font-bold text-foreground mt-1.5">
                      {preview.ambassadorTypesAllowed.map(typeLabel).join(', ') || 'Open to all ambassador types'} only
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      No account yet? Applying starts with a quick ambassador sign-up — name, type, and an ID for verification.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>

            <CampaignTimelineStrip status={preview.status} endDate={preview.endDate} phases={preview.phases} />

            <section className="space-y-3">
              <div>
                <h2 className="text-[17px] font-bold text-foreground">Reward tiers</h2>
                <p className="text-xs text-muted-foreground mt-0.5">What each milestone pays out per registration, from your first referral.</p>
              </div>
              <RewardTiersCard milestoneTiers={milestoneTiers} currentTier={null} />
            </section>

            {speedBonusTiers.length > 0 && (
              <section className="space-y-3">
                <div>
                  <h2 className="text-[17px] font-bold text-foreground">Speed bonus</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A one-time bonus on top of the per-registration rate above, sized to how quickly you hit the milestone.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {speedBonusTiers.map((tier, i) => (
                    <Card key={i} className="border-border/50">
                      <CardContent className="pt-4 pb-4">
                        <Zap className="h-4 w-4 text-muted-foreground mb-2" />
                        <p className="font-semibold text-foreground text-sm">{tier.label}</p>
                        <p className="text-lg font-bold text-foreground mt-1">
                          +<Rupees amount={tier.bonusAmount} />
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Within {tier.withinDays} days of launch</p>
                        {tier.maxWinners && (
                          <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/60">
                            First {tier.maxWinners} to qualify
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-3">
              <div>
                <h2 className="text-[17px] font-bold text-foreground">Leaderboards</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {leaderboardCuts.length} leaderboard{leaderboardCuts.length === 1 ? '' : 's'} configured — every cut of the standings, side
                  by side, and what each one pays.
                </p>
              </div>
              {leaderboardCuts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {leaderboardCuts.map((cut) => (
                    <CampaignLeaderboardCard
                      key={leaderboardScopeKey(cut.scope)}
                      campaignId={campaignId}
                      cut={cut}
                      ownRank={null}
                      currentAmbassadorId={ambassadorId}
                      tierTicks={cut.scope.kind === 'INDIVIDUAL_AMBASSADOR' ? milestoneTiers : undefined}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">No leaderboard configured for this campaign.</p>
              )}
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-[17px] font-bold text-foreground">Ambassador kit</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Unlocks once you're approved — your referral link gets stitched into these automatically.
                </p>
              </div>
              <Card className="border-border/50">
                {preview.posterImageUrl ? (
                  <CardContent className="flex items-center gap-4 py-5">
                    <img
                      src={preview.posterImageUrl}
                      alt="Campaign share poster"
                      className="w-20 h-20 rounded-lg object-cover shrink-0 bg-muted"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        Locked until approved
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This is the poster you&apos;ll share — WhatsApp and Instagram templates unlock with your own referral link once the
                        organizer approves your application.
                      </p>
                    </div>
                  </CardContent>
                ) : (
                  <CardContent className="py-10 flex flex-col items-center text-center gap-2">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Locked until approved</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      WhatsApp and Instagram templates, filled in with your own referral link, unlock the moment the organizer approves your
                      application.
                    </p>
                  </CardContent>
                )}
              </Card>
            </section>
          </div>

          <div className="space-y-4 lg:sticky lg:top-8">
            <Card className="border-border/50">
              <CardContent className="pt-5 pb-5 space-y-4">
                <div>
                  <h3 className="text-[15px] font-bold text-foreground">{hasApplied ? 'Your application' : 'Apply to join'}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {preview.organizationName}
                    {preview.ambassadorTypesAllowed[0] ? ` · ${typeLabel(preview.ambassadorTypesAllowed[0])}` : ''}
                  </p>
                </div>
                {preview.endDate && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Registration closes</span>
                    <span className="font-semibold text-foreground">
                      {new Date(preview.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                )}
                {hasApplied ? (
                  <p className="text-xs text-muted-foreground">
                    {applicationStatus === 'REJECTED'
                      ? rejectionReason || 'This application was not approved.'
                      : "Submitted — you'll get your referral link once the organizer approves it."}
                  </p>
                ) : (
                  <>
                    <Button className="w-full bg-success text-success-foreground hover:bg-success/90" disabled={applying} onClick={onApply}>
                      <UserPlus className="h-4 w-4" />
                      {applying ? 'Applying…' : 'Apply to this campaign'}
                    </Button>
                    <p className="text-[11px] text-muted-foreground text-center">
                      Reviewed by the organizer — you&apos;ll be notified once approved.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
