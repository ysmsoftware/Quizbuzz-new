import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/legal/legal-page-layout';
import { SUPPORT_EMAIL } from '@/lib/seo/config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How QuizBuzz collects, uses, and protects your personal data — including account, registration, payment, and proctoring information.',
  alternates: { canonical: '/privacy' },
};

const LAST_UPDATED = 'August 6, 2026';

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      intro="This policy explains what personal data QuizBuzz collects, why, and how it's used, stored, and protected — for both quiz participants and organizations that host contests on the platform."
    >
      {/*
        Drafted from the app's actual behavior (auth, registration, payments,
        proctoring, analytics). This is a solid starting point, not a
        substitute for review by qualified legal counsel before this page
        governs real user data at scale — confirm the operating entity
        name/address and any region-specific requirements (e.g. India's
        DPDP Act, GDPR if you have EU users) before treating it as final.
      */}

      <div>
        <h2>1. Who we are</h2>
        <p>
          QuizBuzz (&ldquo;QuizBuzz&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is a multi-tenant quiz and contest
          platform that lets organizations create and run quizzes/contests, and lets
          participants discover, register for, and take part in them. This policy applies to
          the QuizBuzz website and web app at ysmquizbuzz.com and any QuizBuzz-branded
          subdomains or organizer pages built on it.
        </p>
      </div>

      <div>
        <h2>2. Information we collect</h2>
        <h3>Account &amp; registration data</h3>
        <p>When you create an organizer account or register for a contest, we collect:</p>
        <ul>
          <li>Name (first and last name)</li>
          <li>Email address (verified via a one-time code)</li>
          <li>Phone number (where required for a contest or organizer account)</li>
          <li>Optional profile details a contest may ask for, such as college/institution, department, city, or state</li>
        </ul>
        <h3>Payment data</h3>
        <p>
          For paid contests, payments are processed by our payment partner, Razorpay. We do
          not store your full card, UPI, or bank details on our servers — Razorpay handles
          that directly and shares only the payment status, amount, and a transaction
          reference with us.
        </p>
        <h3>Proctoring data</h3>
        <p>
          Contests configured with live proctoring use your device&apos;s webcam to run
          face-detection checks (presence, single-face, and attention/gaze checks) directly
          in your browser. Depending on how the contest organizer has configured proctoring,
          detected irregularities (&ldquo;violations&rdquo; — e.g. no face detected, multiple faces,
          looking away, exiting fullscreen) are logged with a timestamp and made visible to
          that contest&apos;s organizer for fairness review. We do not use webcam data for any
          purpose beyond proctoring the specific contest you&apos;re taking.
        </p>
        <h3>Usage &amp; device data</h3>
        <p>
          We use privacy-conscious product analytics (PostHog) and error monitoring (Sentry)
          to understand how the app is used and to diagnose bugs — this can include device
          type, browser, general usage events, and crash/error reports. We also use Vercel
          Analytics for aggregate site traffic metrics.
        </p>
      </div>

      <div>
        <h2>3. How we use your information</h2>
        <ul>
          <li>To create and manage your account or contest registration</li>
          <li>To operate quiz/contest sessions, including proctoring and leaderboard/ranking</li>
          <li>To process payments and registration fees</li>
          <li>To send transactional communications (verification codes, registration confirmations, results, certificates, contest updates)</li>
          <li>To generate and deliver certificates to participants</li>
          <li>To detect and prevent fraud, abuse, or violations of contest rules</li>
          <li>To monitor, maintain, and improve the reliability and performance of the platform</li>
        </ul>
      </div>

      <div>
        <h2>4. Who your data is shared with</h2>
        <ul>
          <li><strong>Contest organizers</strong> — the organization running a contest you register for can see your registration details, submission results, and proctoring violation logs for that contest.</li>
          <li><strong>Service providers</strong> — Razorpay (payments), PostHog (analytics), Sentry (error monitoring), and our cloud hosting/infrastructure providers, strictly to operate the platform.</li>
          <li>We do not sell your personal data.</li>
        </ul>
      </div>

      <div>
        <h2>5. Data retention</h2>
        <p>
          We retain account and contest data for as long as your account is active or as
          needed to provide the service, comply with legal/tax obligations related to
          payments, and resolve disputes. You can request deletion of your account and
          associated personal data at any time (see Section 7).
        </p>
      </div>

      <div>
        <h2>6. Cookies &amp; local storage</h2>
        <p>
          Authentication is handled via a secure, httpOnly session cookie set by our server —
          it isn&apos;t readable by page scripts. We also store a small number of non-sensitive
          preferences (like light/dark theme) in your browser&apos;s local storage. See our{' '}
          <a href="/cookies">Cookie Policy</a> for details.
        </p>
      </div>

      <div>
        <h2>7. Your rights &amp; choices</h2>
        <p>
          You can request access to, correction of, or deletion of your personal data by
          contacting us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Organizer accounts
          can update most profile information directly from account settings.
        </p>
      </div>

      <div>
        <h2>8. Children&apos;s privacy</h2>
        <p>
          QuizBuzz is intended for use by students and professionals capable of entering into
          a registration agreement. If a contest is designed for school-age participants, the
          hosting organization is responsible for obtaining any parental/guardian consent
          required under applicable law.
        </p>
      </div>

      <div>
        <h2>9. Changes to this policy</h2>
        <p>
          We may update this policy as the product evolves. Material changes will be
          reflected by updating the &ldquo;Last updated&rdquo; date above.
        </p>
      </div>

      <div>
        <h2>10. Contact us</h2>
        <p>
          Questions about this policy or your data? Email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </div>
    </LegalPageLayout>
  );
}
