// lib/constants/pwa-excluded-routes.ts

/**
 * Regular expressions matching the path family that must NOT have PWA interference.
 * These are the proctored quiz routes where caching or service worker intercepts must not happen:
 * - /quiz/[slug]/play
 * - /quiz/[slug]/waiting
 * - /quiz/[slug]/system-check
 * - /quiz/[slug]/join
 * - /quiz/[slug]/certificate/[id]
 */
export const PWA_EXCLUDED_PATTERNS = [
  /^\/quiz\/[^/]+\/play(\/|$)/,
  /^\/quiz\/[^/]+\/waiting(\/|$)/,
  /^\/quiz\/[^/]+\/system-check(\/|$)/,
  /^\/quiz\/[^/]+\/join(\/|$)/,
  /^\/quiz\/[^/]+\/certificate(\/|$)/
];

/**
 * Checks if a given pathname should be excluded from PWA interactions (e.g. install prompt, update toaster).
 */
export function isRouteExcluded(pathname: string): boolean {
  return PWA_EXCLUDED_PATTERNS.some((pattern) => pattern.test(pathname));
}

/**
 * Determines if a request should bypass the Service Worker cache completely (NetworkOnly).
 */
export function shouldExcludeFromPwa(url: URL, request: { method: string }): boolean {
  // 1. Excluded page/route patterns
  if (isRouteExcluded(url.pathname)) {
    return true;
  }

  // 2. Socket.IO traffic
  if (url.pathname.includes('/socket.io')) {
    return true;
  }

  // 3. API traffic
  if (url.pathname.startsWith('/api/')) {
    return true;
  }

  // 4. Non-GET requests (POST, PUT, DELETE, PATCH, etc.)
  if (request.method !== 'GET') {
    return true;
  }

  return false;
}
