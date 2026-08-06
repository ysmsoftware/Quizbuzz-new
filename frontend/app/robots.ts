import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/config';

// Routes that require auth, are session/state-specific, or are pure utility
// flows with no indexable content. Keeping these out of the index protects
// user data and avoids diluting the site with low-value/duplicate pages.
const DISALLOWED_PATHS = [
  '/org/', // organizer dashboard — behind auth
  '/quiz/', // live quiz-taking flow — session-specific, behind auth
  '/payment/', // payment callback flow
  '/api/', // internal API routes
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOWED_PATHS,
      },
      // --- Generative / Answer Engine Optimization (GEO/AEO) ---
      // Explicitly welcome the major AI assistant & answer-engine crawlers so
      // QuizBuzz can be cited/surfaced by LLM-based search and chat products.
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'Claude-User', allow: '/' },
      { userAgent: 'Claude-SearchBot', allow: '/' },
      { userAgent: 'anthropic-ai', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Perplexity-User', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'Applebot-Extended', allow: '/' },
      { userAgent: 'Bingbot', allow: '/' },
      { userAgent: 'Amazonbot', allow: '/' },
      { userAgent: 'CCBot', allow: '/' },
      { userAgent: 'FacebookBot', allow: '/' },
      { userAgent: 'meta-externalagent', allow: '/' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
