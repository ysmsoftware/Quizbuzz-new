import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/legal/legal-page-layout';
import { SUPPORT_EMAIL } from '@/lib/seo/config';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'What cookies and local storage QuizBuzz uses, and why.',
  alternates: { canonical: '/cookies' },
};

const LAST_UPDATED = 'August 6, 2026';

export default function CookiePolicyPage() {
  return (
    <LegalPageLayout
      title="Cookie Policy"
      lastUpdated={LAST_UPDATED}
      intro="QuizBuzz keeps cookies and local storage to a minimum — mainly what's needed to keep you signed in and remember your display preferences."
    >
      <div>
        <h2>1. What we use, and why</h2>
        <ul>
          <li>
            <strong>Session cookie (essential)</strong> — a secure, httpOnly cookie set by our
            server that keeps you signed in. It can&apos;t be read by page scripts and isn&apos;t used
            for advertising.
          </li>
          <li>
            <strong>Theme preference (local storage)</strong> — remembers whether you prefer
            light or dark mode. Stored only in your browser, never sent to our servers.
          </li>
          <li>
            <strong>Analytics (PostHog, Vercel Analytics)</strong> — helps us understand
            aggregate usage patterns (which pages are used, general navigation flow) so we can
            improve the product. These may set their own cookies/identifiers in your browser.
          </li>
          <li>
            <strong>Error monitoring (Sentry)</strong> — captures crash and error reports to
            help us fix bugs. This can include a session identifier used to correlate error
            reports, not to track you across other sites.
          </li>
          <li>
            <strong>Payment processing (Razorpay)</strong> — when you pay for a contest entry,
            Razorpay&apos;s checkout may set its own cookies as part of processing your payment
            securely. That&apos;s governed by Razorpay&apos;s own privacy/cookie practices.
          </li>
        </ul>
      </div>

      <div>
        <h2>2. What we don&apos;t do</h2>
        <p>
          We don&apos;t use third-party advertising cookies, and we don&apos;t sell data collected via
          cookies or local storage to advertisers.
        </p>
      </div>

      <div>
        <h2>3. Managing cookies</h2>
        <p>
          Most browsers let you block or delete cookies via their settings. Since our session
          cookie is essential for staying signed in, blocking it will sign you out and may
          prevent parts of the app (like the organizer dashboard or a live proctored quiz
          session) from working correctly.
        </p>
      </div>

      <div>
        <h2>4. Questions</h2>
        <p>
          See our <a href="/privacy">Privacy Policy</a> for the full picture of what data we
          collect, or email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </div>
    </LegalPageLayout>
  );
}
