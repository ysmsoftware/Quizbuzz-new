import { Metadata } from 'next';
import { contestService } from '@/lib/services/contest-service';
import { SITE_URL, SOCIAL_IMAGE } from '@/lib/seo/config';
import { RegisterClient } from './RegisterClient';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string }>;
}

/**
 * Server wrapper around the registration flow (RegisterClient.tsx — unchanged, still fully
 * client-rendered) that exists ONLY to generate metadata: this is the page an ambassador's
 * referral link actually points at, and until now it carried no metadata of its own, so
 * pasting it into WhatsApp/social apps rendered the generic site-wide OG card instead of
 * anything contest- or campaign-specific.
 *
 * When ?ref= resolves to a valid, approved, live ambassador enrollment (see
 * contestService.getContestBySlug -> referralPreview), the link-preview card uses that
 * campaign's own poster image and name — the same "paste a link into WhatsApp and it shows
 * a rich card" mechanism WhatsApp already uses for every other link, rather than trying to
 * attach an image to the message itself (WhatsApp's wa.me links can't carry file
 * attachments at all — this is the actual supported path for a poster to show up
 * automatically). Falls back to the contest's own banner, then the site default, exactly
 * like /contests/[slug]/page.tsx already does for the contest detail page.
 */
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { ref } = await searchParams;
  const result = await contestService.getContestBySlug(slug, { ref });

  if (!result.success || !result.data) {
    return { title: 'Register', robots: { index: false, follow: false } };
  }

  const contest = result.data;
  const preview = contest.referralPreview;
  const title = preview ? `Join ${preview.campaignName}` : `Register — ${contest.title}`;
  const description = preview
    ? `${preview.ambassadorFirstName} invited you to ${contest.title} — register now and climb the leaderboard!`
    : (contest.description ?? `Register for ${contest.title} on QuizBuzz.`);
  const image = preview?.posterImageUrl || contest.bannerImage || SOCIAL_IMAGE;

  return {
    title,
    description,
    alternates: {
      canonical: `/contests/${slug}/register`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/contests/${slug}/register`,
      type: 'website',
      images: [{ url: image, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default function ContestRegisterPage() {
  return <RegisterClient />;
}
