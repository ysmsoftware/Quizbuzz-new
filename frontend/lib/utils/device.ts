/**
 * Detects "an iPhone, running any browser" — not desktop Safari, not iPad,
 * not Android.
 *
 * Why this matters: iPhone's WebKit engine does not implement the Fullscreen
 * API (`Element.requestFullscreen()`) for ordinary page content — only for
 * `<video>` elements. This is a real platform limitation, not a permission
 * or consent issue, and there is no way to fix it from application code.
 * Every third-party browser on iOS (Chrome/CriOS, Firefox/FxiOS, Edge/EdgiOS,
 * etc.) is required by Apple to use the same WebKit engine under the hood
 * (App Store guideline 2.5.6), so this limitation applies identically
 * regardless of which browser app the user has open — checking the device's
 * user-agent token is the correct signal, not the browser name.
 *
 * Deliberately excludes iPad: modern iPadOS Safari generally DOES support
 * the real Fullscreen API (it behaves like desktop Safari), so iPads should
 * always go through the real requestFullscreen() path, not the simulated
 * iPhone fallback. (Older iPads or ones with "Request Mobile Website" forced
 * on may not perfectly match this check — a known, accepted edge case.)
 */
export function isIphoneBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const isMSStream = typeof window !== 'undefined' && !!(window as any).MSStream;
  return /iPhone|iPod/.test(navigator.userAgent) && !isMSStream;
}
