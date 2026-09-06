'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Hero } from './landing/components/Hero';
import { TrustMarquee } from './landing/components/TrustMarquee';
import { ReplaceStack } from './landing/components/ReplaceStack';
import { ContestThread } from './landing/components/ContestThread';
import { OrganizerCommandCenter } from './landing/components/OrganizerCommandCenter';
import { QuestionBuilderSection } from './landing/components/QuestionBuilderSection';
import { ProctoringSection } from './landing/components/ProctoringSection';
import { LiveRoomSection } from './landing/components/LiveRoomSection';
import { AnalyticsSection } from './landing/components/AnalyticsSection';
import { CertificateSection } from './landing/components/CertificateSection';
import { ParticipantExperience } from './landing/components/ParticipantExperience';
import { UseCasesSection } from './landing/components/UseCasesSection';
import { ScaleSection } from './landing/components/ScaleSection';
import { WhiteLabelSection } from './landing/components/WhiteLabelSection';
import { FaqSection } from './landing/components/FaqSection';
import { FinalCta } from './landing/components/FinalCta';
import { Footer as LandingFooter } from './landing/components/Footer';
import { VerifyCertificateModal } from './landing/components/Modals';

export function LandingPage() {
    const router = useRouter();
    const [verifyModalCode, setVerifyModalCode] = useState<string | null>(null);

    const handleCreateContest = () => router.push('/register');
    const handleExploreContests = () => router.push('/contests');

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--primary)] selection:text-[var(--primary-foreground)] flex flex-col font-sans">
            <div className="grain" />

            <Header />

            <main className="flex-1">
                <Hero onCreateContest={handleCreateContest} onExploreContests={handleExploreContests} />
                <TrustMarquee />
                <ReplaceStack />
                <ContestThread />
                <OrganizerCommandCenter />
                <QuestionBuilderSection />
                <ProctoringSection />
                <LiveRoomSection />
                <AnalyticsSection />
                <CertificateSection onVerifyClick={(code) => setVerifyModalCode(code)} />
                <ParticipantExperience onExploreContests={handleExploreContests} />
                <UseCasesSection onCreateContest={handleCreateContest} />
                <ScaleSection />
                <WhiteLabelSection />
                <FaqSection />
                <FinalCta onCreateContest={handleCreateContest} onExploreContests={handleExploreContests} />
            </main>

            <LandingFooter />

            <VerifyCertificateModal
                isOpen={verifyModalCode !== null}
                code={verifyModalCode ?? ''}
                onClose={() => setVerifyModalCode(null)}
            />
        </div>
    );
}
