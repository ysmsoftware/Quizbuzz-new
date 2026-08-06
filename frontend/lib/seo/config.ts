// lib/seo/config.ts
//
// Single source of truth for SEO / GEO / AEO related constants.
// Reads NEXT_PUBLIC_APP_URL (already used elsewhere in the app for building
// public share links) so metadata, sitemap.xml, robots.txt and llms.txt all
// stay in sync with whatever domain the app is actually deployed on.

const rawSiteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ysmquizbuzz.com';

/** Production site URL, no trailing slash. */
export const SITE_URL = rawSiteUrl.replace(/\/$/, '');

export const SITE_NAME = 'QuizBuzz';

export const SITE_DESCRIPTION =
  'QuizBuzz is a multi-tenant, real-time quiz and contest platform. Create, manage, and proctor online quizzes and contests, or browse and join live contests with real-time leaderboards, AI-assisted proctoring, and instant certificates.';

export const SITE_KEYWORDS = [
  'quiz platform',
  'online quiz contest',
  'proctored online exam',
  'quiz contest app',
  'real-time leaderboard',
  'online assessment platform',
  'multi-tenant quiz software',
  'AI proctoring',
  'quiz certificate generator',
  'QuizBuzz',
];

export const SOCIAL_IMAGE = `${SITE_URL}/og-image.png`;

/**
 * No official Twitter/X handle exists in the codebase yet (footer social
 * links are still placeholders). Set this once the account exists so
 * `twitter.site` can be added to metadata — leave null until then rather
 * than asserting a handle that isn't real.
 */
export const TWITTER_HANDLE: string | null = null;

/** Single source of truth for the support contact channels — used in the
 * footer, contact page, legal pages, and JSON-LD contact point. */
export const SUPPORT_EMAIL = 'info@ysminfosolution.com';
export const SUPPORT_WHATSAPP_DISPLAY = '+91 89830 83698';
export const SUPPORT_WHATSAPP_URL = 'https://api.whatsapp.com/send?phone=918983083698';
