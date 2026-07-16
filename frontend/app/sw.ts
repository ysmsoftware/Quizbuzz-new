/// <reference lib="webworker" />

import { type PrecacheEntry, Serwist, NetworkOnly, NetworkFirst, StaleWhileRevalidate, CacheFirst, ExpirationPlugin } from 'serwist';
import { shouldExcludeFromPwa } from '../lib/constants/pwa-excluded-routes';

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    cleanupOutdatedCaches: true,
  },
  runtimeCaching: [
    // 1. Hard exclusions - must be NetworkOnly with absolutely no caching or SW intercepts
    {
      matcher({ url, request }) {
        return shouldExcludeFromPwa(url, request);
      },
      handler: new NetworkOnly(),
    },
    // 2. NetworkFirst for navigation/pages (dashboard, contests, etc.) with a 3-second timeout
    {
      matcher({ request }) {
        return request.mode === 'navigate';
      },
      handler: new NetworkFirst({
        cacheName: 'pages-cache',
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          }),
        ],
      }),
    },
    // 3. StaleWhileRevalidate for static assets (scripts, stylesheets, fonts)
    {
      matcher({ request, url }) {
        return (
          request.destination === 'style' ||
          request.destination === 'script' ||
          request.destination === 'font' ||
          url.pathname.startsWith('/_next/static/')
        );
      },
      handler: new StaleWhileRevalidate({
        cacheName: 'static-assets',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 150,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
        ],
      }),
    },
    // 4. CacheFirst for public images and PWA icons
    {
      matcher({ request, url }) {
        return (
          request.destination === 'image' ||
          url.pathname.startsWith('/icons/') ||
          (url.pathname.startsWith('/public/') && /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname))
        );
      },
      handler: new CacheFirst({
        cacheName: 'images-cache',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
        ],
      }),
    },
  ],
  // Fallbacks config: serves /offline when navigation request fails and there is no cache hit
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.mode === 'navigate';
        },
      },
    ],
  },
});

// Update handling: listen to custom skipWaiting message triggered from frontend toast
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

serwist.addEventListeners();
