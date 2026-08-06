// lib/seo/json-ld.tsx
//
// Reusable JSON-LD (schema.org) structured data. This is what search engines
// use for rich results, and increasingly what LLM answer engines (Google AI
// Overviews, Bing Copilot, Perplexity, ChatGPT browsing) use to accurately
// ground answers about the site — the "AEO/GEO" half of this work.
//
// Only real, verifiable facts already present in the UI are encoded here
// (no invented ratings, review counts, or prices) to stay within Google's
// structured-data guidelines.

import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY } from './config';

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Site-wide Organization + WebSite graph — rendered once in the root layout. */
export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_URL}/quizBuzz-logo.png`,
        },
        description: SITE_DESCRIPTION,
        email: SUPPORT_EMAIL,
        contactPoint: [
          {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            email: SUPPORT_EMAIL,
            telephone: SUPPORT_WHATSAPP_DISPLAY,
            areaServed: 'IN',
            availableLanguage: ['English', 'Hindi'],
          },
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'en-US',
      },
    ],
  };
  return <JsonLd data={data} />;
}

/** WebApplication schema for the homepage — describes what the product does. */
export function WebApplicationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any (Web, iOS, Android via PWA)',
    offers: {
      '@type': 'Offer',
      category: 'Freemium',
    },
    featureList: [
      'Competitive quiz and contest hosting',
      'AI-assisted webcam and fullscreen proctoring',
      'Real-time leaderboards',
      'Automatic answer auto-save and session recovery',
      'Participant analytics and exportable reports',
      'Automated certificate generation',
    ],
  };
  return <JsonLd data={data} />;
}

/** FAQPage schema — powers Google/AI-answer-engine rich results directly from real Q&A copy. */
export function FAQJsonLd({ items }: { items: { question: string; answer: string }[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
  return <JsonLd data={data} />;
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
  return <JsonLd data={data} />;
}

/** Event schema for an individual contest — built from real contest data. */
export function ContestEventJsonLd({
  title,
  description,
  slug,
  startTime,
  durationMinutes,
  organizationName,
  bannerImage,
}: {
  title: string;
  description: string | null;
  slug: string;
  startTime: string;
  durationMinutes: number;
  organizationName?: string;
  bannerImage?: string | null;
}) {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: title,
    description: description || `${title} — a quiz contest hosted on QuizBuzz.`,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'VirtualLocation',
      url: `${SITE_URL}/contests/${slug}`,
    },
    url: `${SITE_URL}/contests/${slug}`,
    ...(bannerImage ? { image: [bannerImage] } : {}),
    organizer: {
      '@type': 'Organization',
      name: organizationName || SITE_NAME,
    },
  };
  return <JsonLd data={data} />;
}
