import type { Metadata } from 'next';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';

// Own manifest so "Add to Home Screen" from /ambassador installs as its own labeled
// app (QuizBuzz Ambassador) instead of the default marketing-site install.
export const metadata: Metadata = {
  manifest: '/ambassador/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'QuizBuzz Ambassador',
  },
};

export default function AmbassadorLayout({ children }: { children: React.ReactNode }) {
  return <WidgetErrorBoundary name="Ambassador">{children}</WidgetErrorBoundary>;
}
