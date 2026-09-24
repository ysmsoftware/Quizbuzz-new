import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/layout/footer';
import { ContestDetails } from '@/components/contests/contest-details';
import { contestService } from '@/lib/services';
import { BreadcrumbJsonLd, ContestEventJsonLd } from '@/lib/seo/json-ld';
import { SITE_URL } from '@/lib/seo/config';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string }>;
}

/** Ambassador referral links point here (/contests/[slug]?ref=CODE), not at /register, so a
 *  visitor can read the details first — the code rides along on every Register button. */
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { ref } = await searchParams;
  const result = await contestService.getContestBySlug(slug, { ref });

  if (!result.success || !result.data) {
    return {
      title: 'Contest Not Found',
      robots: { index: false, follow: false },
    };
  }

  const contest = result.data;
  // A valid ambassador ?ref= gets the campaign's own link-preview card (poster + invite line),
  // same as /register used to when referral links pointed there.
  const preview = contest.referralPreview;
  const title = preview ? `Join ${preview.campaignName}` : contest.title;
  const description = preview
    ? `${preview.ambassadorFirstName} invited you to ${contest.title} — register now and climb the leaderboard!`
    : (contest.description ?? `Join ${contest.title}, a live quiz contest on QuizBuzz.`);
  const image = preview?.posterImageUrl || contest.bannerImage;

  return {
    title,
    description,
    alternates: {
      canonical: `/contests/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/contests/${slug}`,
      type: 'website',
      ...(image ? { images: [{ url: image, alt: title }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ContestPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { ref } = await searchParams;
  const result = await contestService.getContestBySlug(slug);

  if (!result.success || !result.data) {
    notFound();
  }

  const contest = result.data;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Browse Contests', url: `${SITE_URL}/contests` },
          { name: contest.title, url: `${SITE_URL}/contests/${slug}` },
        ]}
      />
      <ContestEventJsonLd
        title={contest.title}
        description={contest.description}
        slug={slug}
        startTime={contest.startTime}
        durationMinutes={contest.duration}
        organizationName={contest.organization?.name}
        bannerImage={contest.bannerImage}
      />
      <ContestDetails contest={contest} referralCode={ref} />
      <Footer />
    </>
  );
}
