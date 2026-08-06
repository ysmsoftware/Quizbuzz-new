import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/legal/legal-page-layout';
import { SUPPORT_EMAIL } from '@/lib/seo/config';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that govern use of QuizBuzz — for both quiz/contest organizers and participants.',
  alternates: { canonical: '/terms' },
};

const LAST_UPDATED = 'August 6, 2026';

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      lastUpdated={LAST_UPDATED}
      intro="These terms govern your use of QuizBuzz, whether you're organizing contests or participating in them. By creating an account, registering for a contest, or otherwise using QuizBuzz, you agree to these terms."
    >
      {/*
        Drafted from the platform's real features (paid registration via
        Razorpay, proctoring, certificates, organizer/participant roles).
        Treat as a strong starting draft — have it reviewed by counsel
        before it governs paid transactions at scale.
      */}

      <div>
        <h2>1. Accounts</h2>
        <p>
          Organizer accounts require a verified email address. You&apos;re responsible for keeping
          your login credentials secure and for all activity under your account. Participants
          register per-contest with a verified email and, where required, additional contact
          details.
        </p>
      </div>

      <div>
        <h2>2. Using QuizBuzz as an organizer</h2>
        <ul>
          <li>You&apos;re responsible for the accuracy and legality of the quizzes/contests you publish, including question content, prizes, and any claims made to participants.</li>
          <li>You must clearly communicate your own contest&apos;s rules, eligibility, pricing, and refund terms to participants — QuizBuzz provides the platform, not the contest&apos;s terms.</li>
          <li>You may not use QuizBuzz to run contests that are fraudulent, illegal gambling, or that violate applicable consumer-protection law.</li>
          <li>You&apos;re responsible for how you use participant data collected through your contests, in line with our Privacy Policy and applicable law.</li>
        </ul>
      </div>

      <div>
        <h2>3. Using QuizBuzz as a participant</h2>
        <ul>
          <li>You must provide accurate registration information.</li>
          <li>For proctored contests, you agree to comply with the proctoring requirements set by the organizer (webcam on, fullscreen mode, no unauthorized assistance) — violating these may result in disqualification at the organizer&apos;s discretion.</li>
          <li>Attempting to cheat, impersonate another participant, or interfere with a contest&apos;s fairness (including tampering with proctoring) may result in disqualification and forfeiture of any entry fee.</li>
        </ul>
      </div>

      <div>
        <h2>4. Payments &amp; refunds</h2>
        <p>
          Paid contest entries are processed securely through Razorpay. Refund eligibility for
          a specific contest is set by that contest&apos;s organizer — check the contest details
          before registering. If a payment is debited but registration isn&apos;t confirmed, contact{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we&apos;ll help you
          track it down with the organizer and payment provider.
        </p>
      </div>

      <div>
        <h2>5. Certificates &amp; results</h2>
        <p>
          Where a contest offers certificates, they&apos;re generated automatically based on your
          submission and the organizer&apos;s configured criteria. Results, rankings, and
          certificate eligibility are determined by the organizer&apos;s contest rules.
        </p>
      </div>

      <div>
        <h2>6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Attempt to disrupt, reverse-engineer, or gain unauthorized access to the platform</li>
          <li>Use automated tools to scrape or bulk-register for contests</li>
          <li>Upload or transmit content that is unlawful, infringing, or harmful</li>
          <li>Circumvent proctoring or fullscreen enforcement mechanisms</li>
        </ul>
      </div>

      <div>
        <h2>7. Intellectual property</h2>
        <p>
          The QuizBuzz name, logo, and platform software are owned by us. Quiz content,
          questions, and branding you upload as an organizer remain yours — by publishing a
          contest, you grant us a license to host, display, and process that content solely to
          operate the platform.
        </p>
      </div>

      <div>
        <h2>8. Availability</h2>
        <p>
          We aim for high uptime but don&apos;t guarantee uninterrupted access. See our{' '}
          <a href="/status">System Status</a> page for current service status. We&apos;re not
          liable for losses caused by scheduled maintenance, third-party outages (e.g. payment
          gateway downtime), or events outside our reasonable control.
        </p>
      </div>

      <div>
        <h2>9. Limitation of liability</h2>
        <p>
          QuizBuzz is provided &ldquo;as is.&rdquo; To the fullest extent permitted by law, we&apos;re not
          liable for indirect, incidental, or consequential damages arising from your use of
          the platform, including disputes between organizers and participants over a specific
          contest&apos;s rules, prizes, or refunds.
        </p>
      </div>

      <div>
        <h2>10. Termination</h2>
        <p>
          We may suspend or terminate accounts that violate these terms, engage in fraud, or
          misuse the platform. You may stop using QuizBuzz and request account deletion at any
          time.
        </p>
      </div>

      <div>
        <h2>11. Changes to these terms</h2>
        <p>
          We may update these terms as QuizBuzz evolves. Continued use after an update means
          you accept the revised terms.
        </p>
      </div>

      <div>
        <h2>12. Contact</h2>
        <p>
          Questions about these terms? Email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </div>
    </LegalPageLayout>
  );
}
