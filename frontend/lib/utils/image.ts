import type { SyntheticEvent } from 'react';

/** Shared `<img onError>` handler for any user-uploaded image (banner, logo, goodie/prize
 *  photo, campaign poster) — falls back to the static placeholder instead of a broken-image
 *  icon. `onerror = null` stops a retry loop if placeholder.svg itself ever fails to load. */
export function onImageError(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.onerror = null;
  e.currentTarget.src = '/placeholder.svg';
}
