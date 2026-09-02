import { NextResponse } from 'next/server';
import { PWA_ICONS } from '@/lib/constants/pwa-icons';

// Next.js's manifest.ts special-file convention only works at the app root, so this
// route serves the ambassador-specific manifest by hand (same JSON shape) —
// app/ambassador/layout.tsx links to it via metadata.manifest.
export function GET() {
  return NextResponse.json(
    {
      id: '/ambassador',
      name: 'QuizBuzz Ambassador',
      short_name: 'QB Ambassador',
      description: 'Track campaigns, referrals, and earnings as a QuizBuzz ambassador.',
      start_url: '/ambassador/dashboard?source=pwa',
      scope: '/ambassador',
      display: 'standalone',
      background_color: '#fafafa',
      theme_color: '#0d9488',
      orientation: 'portrait-primary',
      lang: 'en-US',
      icons: PWA_ICONS,
      categories: ['education', 'productivity'],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } }
  );
}
