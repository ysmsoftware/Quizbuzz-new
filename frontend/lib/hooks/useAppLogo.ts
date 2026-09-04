'use client';

import { useEffect, useState } from 'react';
import { getAppLogo } from '@/lib/api/settings.api';

/**
 * The platform-wide app logo, managed from the ops dashboard. Returns null
 * (never throws) until a logo is set or the fetch fails — callers should
 * fall back to the bundled static logo in that case.
 */
export function useAppLogo(): string | null {
  const [appLogoUrl, setAppLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAppLogo()
      .then((res) => {
        if (!cancelled) setAppLogoUrl(res.data.appLogoUrl);
      })
      .catch(() => {
        // static fallback logo covers this — no need to surface an error
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return appLogoUrl;
}
