'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { Download, Share, PlusSquare, BookOpen, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { usePwaStore } from '@/lib/stores/pwa-store';
import { isRouteExcluded } from '@/lib/constants/pwa-excluded-routes';

const COOLDOWN_DAYS = 7;
const DISMISSAL_KEY = 'pwa-install-dismissed-at';

export function InstallPrompt() {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [isIosSafari, setIsIosSafari] = useState(false);

  const {
    deferredPrompt,
    showInstallPrompt,
    setShowInstallPrompt,
    isStandalone,
    setIsStandalone,
    setDeferredPrompt,
    triggerInstall,
  } = usePwaStore();

  // Helper: check dismissal cooldown
  const isDismissedOnCooldown = (): boolean => {
    if (typeof window === 'undefined') return false;
    const dismissedAt = localStorage.getItem(DISMISSAL_KEY);
    if (!dismissedAt) return false;
    const dismissedTime = parseInt(dismissedAt, 10);
    const now = Date.now();
    const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    return now - dismissedTime < cooldownMs;
  };

  useEffect(() => {
    setIsMounted(true);
    if (process.env.NEXT_PUBLIC_ENABLE_PWA !== 'true') return;

    // 1. Detect standalone/installed state
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();

    // 2. Detect iOS Safari
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isIos && isSafari && !isStandaloneMode) {
      setIsIosSafari(true);
      // Auto-trigger iOS prompt if not dismissed recently
      if (!isDismissedOnCooldown() && !isRouteExcluded(pathname)) {
        setShowInstallPrompt(true);
      }
    }

    // 3. Listen for beforeinstallprompt event (Android/Chrome/Edge)
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Auto-trigger Android/Desktop prompt if not dismissed recently
      if (!isDismissedOnCooldown() && !isRouteExcluded(pathname)) {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // 4. Register service worker and listen for updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check for waiting update on startup
          if (registration.waiting) {
            handleSWUpdate(registration.waiting);
          }

          // Listen for subsequent updates
          registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  handleSWUpdate(installingWorker);
                }
              });
            }
          });
        })
        .catch((err) => {
          console.error('Service Worker registration failed:', err);
        });
    }

    // Watch controller changes to reload clients when skipWaiting is active
    let refreshing = false;
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };
    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [pathname, setDeferredPrompt, setShowInstallPrompt, setIsStandalone]);

  // Handler for service worker updates
  const handleSWUpdate = (waitingWorker: ServiceWorker) => {
    // If route is excluded (exam/realtime), suppress the update toast completely
    if (isRouteExcluded(pathname)) {
      return;
    }

    toast('Update Available', {
      description: 'A new version is ready. Refresh to update to the latest version.',
      duration: Infinity,
      action: {
        label: 'Refresh',
        onClick: () => {
          waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        },
      },
    });
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSAL_KEY, Date.now().toString());
    setShowInstallPrompt(false);
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      const installed = await triggerInstall();
      if (installed) {
        toast.success('QuizBuzz successfully installed!');
      }
    }
  };

  // Safe guard: check environment flag, mounted state, standalone, and pathname exclusions
  if (!isMounted) return null;
  if (process.env.NEXT_PUBLIC_ENABLE_PWA !== 'true') return null;
  if (isStandalone) return null;
  if (isRouteExcluded(pathname)) return null;

  return (
    <Drawer open={showInstallPrompt} onOpenChange={setShowInstallPrompt}>
      <DrawerContent className="p-0 border-t bg-background">
        <div className="mx-auto max-w-md w-full px-6 py-6 space-y-6">
          <DrawerHeader className="p-0 text-center sm:text-left">
            <div className="flex justify-center sm:justify-start items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary">
                <BookOpen className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="text-left">
                <DrawerTitle className="text-xl font-bold tracking-tight">
                  Quiz<span className="text-primary">Buzz</span> App
                </DrawerTitle>
                <DrawerDescription className="text-muted-foreground text-sm">
                  Real-time contest & quiz platform
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>

          {isIosSafari ? (
            // iOS Safari Flow
            <div className="bg-secondary/40 rounded-xl p-5 space-y-4 border border-border/50 text-sm">
              <p className="font-semibold text-foreground text-center sm:text-left">
                To install QuizBuzz on your iOS device:
              </p>
              <ol className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                    1
                  </div>
                  <span className="leading-relaxed">
                    Tap the{' '}
                    <strong className="text-foreground inline-flex items-center gap-1 font-medium">
                      Share <Share className="h-4 w-4 inline text-primary" />
                    </strong>{' '}
                    button in Safari.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                    2
                  </div>
                  <span className="leading-relaxed">
                    Scroll down and select{' '}
                    <strong className="text-foreground inline-flex items-center gap-1 font-medium">
                      Add to Home Screen <PlusSquare className="h-4 w-4 inline text-primary" />
                    </strong>
                    .
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                    3
                  </div>
                  <span className="leading-relaxed">
                    Tap <strong className="text-foreground font-medium">Add</strong> in the top right corner.
                  </span>
                </li>
              </ol>
            </div>
          ) : (
            // Standard beforeinstallprompt Flow (Chrome / Edge / Android)
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm leading-relaxed text-center sm:text-left">
                Install our official application for offline access fallback, lightning-fast quiz loads, and instant leaderboard alerts.
              </p>
            </div>
          )}

          <DrawerFooter className="p-0 flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="flex-1"
            >
              Not now
            </Button>
            {!isIosSafari && (
              <Button
                onClick={handleInstallClick}
                disabled={!deferredPrompt}
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                Install
              </Button>
            )}
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
