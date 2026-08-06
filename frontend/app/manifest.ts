import { MetadataRoute } from 'next';
import { metadata } from './layout';

export default function manifest(): MetadataRoute.Manifest {
  return {
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
    icons: [
      {
        src: '/icon.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['education', 'productivity'],
  };
}
