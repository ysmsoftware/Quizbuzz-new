'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { usePwaStore } from '@/lib/stores/pwa-store';

export function HeroInstallButton() {
  const { deferredPrompt, isStandalone, setShowInstallPrompt } = usePwaStore();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_PWA !== 'true') return;
    if (isStandalone) return;

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);

    if (deferredPrompt || (isIos && isSafari)) {
      setShow(true);
    } else {
      setShow(false);
    }
  }, [deferredPrompt, isStandalone]);

  if (!show) return null;

  return (
    <Button
      size="lg"
      onClick={() => setShowInstallPrompt(true)}
      className="w-full sm:w-auto gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-md transition-all flex items-center justify-center cursor-pointer"
    >
      <Download className="h-5 w-5" />
      Install App
    </Button>
  );
}

export function BottomInstallButton() {
  const { deferredPrompt, isStandalone, setShowInstallPrompt } = usePwaStore();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_PWA !== 'true') return;
    if (isStandalone) return;

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);

    if (deferredPrompt || (isIos && isSafari)) {
      setShow(true);
    } else {
      setShow(false);
    }
  }, [deferredPrompt, isStandalone]);

  if (!show) return null;

  return (
    <Button
      size="lg"
      variant="outline"
      onClick={() => setShowInstallPrompt(true)}
      className="w-full sm:w-auto gap-2 border-primary-foreground bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-medium transition-all flex items-center justify-center cursor-pointer"
    >
      <Download className="h-5 w-5" />
      Install App
    </Button>
  );
}

export function FloatingInstallButton() {
  const { deferredPrompt, isStandalone, setShowInstallPrompt } = usePwaStore();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_PWA !== 'true') return;
    if (isStandalone) return;

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);

    if (deferredPrompt || (isIos && isSafari)) {
      setShow(true);
    } else {
      setShow(false);
    }
  }, [deferredPrompt, isStandalone]);

  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 animate-pulse">
      <Button
        onClick={() => setShowInstallPrompt(true)}
        className="rounded-full h-14 w-14 p-0 shadow-lg bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center border border-border cursor-pointer transition-all duration-300 hover:scale-105"
        title="Install QuizBuzz App"
      >
        <Download className="h-6 w-6" />
      </Button>
    </div>
  );
}
