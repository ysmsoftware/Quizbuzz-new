import { NextResponse } from 'next/server';
import { PWA_ICONS } from '@/lib/constants/pwa-icons';
import { metadata } from '../layout';

export function GET() {
  return NextResponse.json(
    {
      id: '/',
      name: 'QuizBuzz — Real-Time Quiz Contests',
      short_name: 'QuizBuzz',
      description: (metadata.description as string) || 'Real-time proctored quiz and contest platform.',
      start_url: '/?source=pwa',
      scope: '/',
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
