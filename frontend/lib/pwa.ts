/**
 * PWA (service worker + install prompts) is a production-build feature.
 *
 * It must stay OFF under `next dev`: with NEXT_PUBLIC_ENABLE_PWA=true in .env.local, Serwist rewrote
 * public/sw.js on every rebuild, Next watches public/, and the dev server rebuilt forever (endless Fast
 * Refresh); the client also registered that stale sw.js and served cached chunks. To try the PWA locally,
 * use `npm run build && npm start`.
 */
export const PWA_ENABLED = process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ENABLE_PWA === 'true';
