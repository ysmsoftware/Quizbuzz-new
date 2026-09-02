import type { Metadata } from 'next';
import { OrgLayoutClient } from './OrgLayoutClient';

// Own manifest so "Add to Home Screen" from /org installs as its own labeled
// app (QuizBuzz Organizer) instead of the default marketing-site install.
export const metadata: Metadata = {
    manifest: '/org/manifest.webmanifest',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'QuizBuzz Organizer',
    },
};

export default function OrgLayout({ children }: { children: React.ReactNode }) {
    return <OrgLayoutClient>{children}</OrgLayoutClient>;
}
