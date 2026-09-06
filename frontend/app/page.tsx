import { LandingPage } from '@/components/LandingPage';
import { FloatingInstallButton } from '@/components/pwa/LandingInstallButtons';
import { StandalonePwaEntryRedirect } from '@/components/pwa/StandalonePwaEntryRedirect';
import { WebApplicationJsonLd } from '@/lib/seo/json-ld';

export default function HomePage() {
    return (
        <>
            <WebApplicationJsonLd />
            <StandalonePwaEntryRedirect />
            <LandingPage />
            <FloatingInstallButton />
        </>
    );
}
