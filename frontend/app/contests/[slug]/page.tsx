import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/layout/footer';
import { ContestDetails } from '@/components/contests/contest-details';
import { contestService } from '@/lib/services';
import { BreadcrumbJsonLd, ContestEventJsonLd } from '@/lib/seo/json-ld';
import { SITE_URL } from '@/lib/seo/config';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await contestService.getContestBySlug(slug);

  if (!result.success || !result.data) {
    return {
      title: 'Contest Not Found',
      robots: { index: false, follow: false },
    };
  }

  const contest = result.data;
  const description =
    contest.description ?? `Join ${contest.title}, a live quiz contest on QuizBuzz.`;

  return {
    title: contest.title,
    description,
    alternates: {
      canonical: `/contests/${slug}`,
    },
    openGraph: {
      title: contest.title,
      description,
      url: `${SITE_URL}/contests/${slug}`,
      type: 'website',
      ...(contest.bannerImage
        ? { images: [{ url: contest.bannerImage, alt: contest.title }] }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: contest.title,
      description,
      ...(contest.bannerImage ? { images: [contest.bannerImage] } : {}),
    },
  };
}

export default async function ContestPage({ params }: PageProps) {
  const { slug } = await params;
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
      <ContestDetails contest={contest} />
      <Footer />
    </>
  );
}
