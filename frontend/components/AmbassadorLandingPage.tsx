'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { usePlatformAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { usePublicCampaigns } from '@/lib/hooks/useAmbassadorCampaigns';
import { Hero } from './ambassador-landing/components/Hero';
import { ValueStrip } from './ambassador-landing/components/ValueStrip';
import { NetworkStats } from './ambassador-landing/components/NetworkStats';
import { EcosystemDiagram } from './ambassador-landing/components/EcosystemDiagram';
import { CampaignMarketplace } from './ambassador-landing/components/CampaignMarketplace';
import { AmbassadorDashboardPreview } from './ambassador-landing/components/AmbassadorDashboardPreview';
import { ReferralFunnelTracking } from './ambassador-landing/components/ReferralFunnelTracking';
import { SharingToolkit } from './ambassador-landing/components/SharingToolkit';
import { RewardsProgression } from './ambassador-landing/components/RewardsProgression';
import { HowItWorksTimeline } from './ambassador-landing/components/HowItWorksTimeline';
import { AmbassadorTypes } from './ambassador-landing/components/AmbassadorTypes';
import { BenefitsGrid } from './ambassador-landing/components/BenefitsGrid';
import { EligibilitySection } from './ambassador-landing/components/EligibilitySection';
import { ContestTypesSection } from './ambassador-landing/components/ContestTypesSection';
import { AmbassadorStories } from './ambassador-landing/components/AmbassadorStories';
import { SymmetrySection } from './ambassador-landing/components/SymmetrySection';
import { FaqSection } from './ambassador-landing/components/FaqSection';
import { FinalCta } from './ambassador-landing/components/FinalCta';
import { Footer as AmbassadorFooter } from './ambassador-landing/components/Footer';
import { mapAvailableCampaignToLocal } from './ambassador-landing/mapAvailableCampaign';

export function AmbassadorLandingPage() {
    const router = useRouter();
    const { types } = usePlatformAmbassadorTypes();
    const { campaigns: liveCampaigns, isLoading: campaignsLoading } = usePublicCampaigns({ limit: 6 });

    const typeLabel = (key: string) => types.find((t) => t.key === key)?.label ?? key;
    const campaigns = liveCampaigns.map((c) => mapAvailableCampaignToLocal(c, typeLabel));

    const goToSignup = () => router.push('/ambassador/signup');
    const scrollToCampaigns = () => {
        document.getElementById('campaigns')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            {/* Ambassador top bar — dedicated, not the main app header */}
            <header className="border-b border-[var(--border)]/60">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
                    <Link href="/ambassador" className="flex items-center gap-2.5">
                        <Image src="/quizBuzz-logo.png" alt="QuizBuzz" width={120} height={34} className="h-6 w-auto sm:h-7" />
                        <span className="hidden text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] sm:inline">
                            Ambassador Program
                        </span>
                    </Link>
                    <Link
                        href="/ambassador/login"
                        className="animate-glow-amber inline-flex items-center justify-center rounded-xl border border-emerald-500 bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-all hover:bg-[var(--secondary)] active:scale-98"
                    >
                        Already an ambassador? Log in
                    </Link>
                </div>
            </header>

            <main>
                <Hero onOpenApply={goToSignup} onExploreCampaigns={scrollToCampaigns} />
                <ValueStrip />
                <NetworkStats />
                <EcosystemDiagram />
                <CampaignMarketplace
                    campaigns={campaigns}
                    isLoading={campaignsLoading}
                    onSelectCampaign={(c) => router.push(`/campaigns/${c.id}`)}
                />
                <AmbassadorDashboardPreview />
                <ReferralFunnelTracking />
                <SharingToolkit />
                <RewardsProgression />
                <HowItWorksTimeline />
                <AmbassadorTypes onSelectRoleForApply={goToSignup} />
                <BenefitsGrid />
                <EligibilitySection />
                <ContestTypesSection />
                <AmbassadorStories />
                <SymmetrySection onOpenApply={goToSignup} />
                <FaqSection />
                <FinalCta onOpenApply={goToSignup} onExploreCampaigns={scrollToCampaigns} />
            </main>

            <AmbassadorFooter />
        </div>
    );
}
