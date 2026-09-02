'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as authApi from '@/lib/api/auth.api';
import { ambassadorService } from '@/lib/services/ambassador-service';

/**
 * iOS home-screen web clips snapshot the manifest's start_url at "Add to Home Screen"
 * time and never re-fetch it — an icon added before this route existed (or added from
 * the marketing page instead of /ambassador or /org) permanently reopens to "/". This
 * is the safety net: on a standalone launch that lands here, check for a live ambassador
 * or organizer session and hop straight to that dashboard instead of showing the landing
 * page. Only runs in standalone mode so regular browser visits pay no extra request.
 */
export function StandalonePwaEntryRedirect() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!isStandalone) return;

    let cancelled = false;
    setChecking(true);

    (async () => {
      try {
        await ambassadorService.getMe();
        if (!cancelled) router.replace('/ambassador/dashboard');
        return;
      } catch {
        // Not an ambassador session — fall through to check organizer.
      }
      try {
        const res = await authApi.getMe();
        if (!cancelled && (res?.data as { id?: string } | undefined)?.id) {
          router.replace('/org');
          return;
        }
      } catch {
        // Not an organizer session either — stay on the landing page.
      }
      if (!cancelled) setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!checking) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
