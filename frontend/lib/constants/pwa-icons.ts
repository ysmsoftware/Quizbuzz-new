import { MetadataRoute } from 'next';

// Shared across all manifest.ts files (root, org, ambassador) — same logo asset,
// only name/short_name/start_url differ per install so the home-screen label
// tells organizer and ambassador installs apart.
export const PWA_ICONS: MetadataRoute.Manifest['icons'] = [
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
];
