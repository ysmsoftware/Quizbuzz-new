import { NextResponse } from 'next/server';
import { PWA_ICONS } from '@/lib/constants/pwa-icons';

// Next.js's manifest.ts special-file convention only works at the app root, so this
// route serves the org-specific manifest by hand (same JSON shape) — Next.org/layout.tsx
// links to it via metadata.manifest.
export function GET() {
  return NextResponse.json(
    {
      id: '/org',
      name: 'QuizBuzz Organizer',
      short_name: 'QB Organizer',
      description: 'Manage contests, questions, participants, and results on QuizBuzz.',
      start_url: '/org?source=pwa',
      scope: '/org',
      display: 'standalone',
      background_color: '#fafafa',
      theme_color: '#0d9488',
      orientation: 'portrait-primary',
      lang: 'en-US',
      icons: PWA_ICONS,
      categories: ['education', 'productivity', 'business'],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } }
  );
}
