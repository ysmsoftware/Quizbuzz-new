'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { BookOpen, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaStore } from '@/lib/stores/pwa-store';

/**
 * Minimal header for public contest/quiz flows — no admin Sign In / Create Account.
 */
export function PublicHeader() {
  const { deferredPrompt, isStandalone, setShowInstallPrompt } = usePwaStore();
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_PWA !== 'true') return;
    if (isStandalone) return;

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);

    if (deferredPrompt || (isIos && isSafari)) {
      setShowInstallBtn(true);
    } else {
      setShowInstallBtn(false);
    }
  }, [deferredPrompt, isStandalone]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <BookOpen className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Quiz<span className="text-primary">Buzz</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          {showInstallBtn && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInstallPrompt(true)}
              className="text-primary font-medium hover:text-primary hover:bg-secondary flex items-center gap-1.5 h-8 px-2"
            >
              <Download className="h-3.5 w-3.5" />
              Install App
            </Button>
          )}
          <Link
            href="/contests"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Browse Contests
          </Link>
        </div>
      </nav>
    </header>
  );
}

