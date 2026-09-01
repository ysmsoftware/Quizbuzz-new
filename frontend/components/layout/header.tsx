'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Menu, X, Download } from 'lucide-react';
import { usePwaStore } from '@/lib/stores/pwa-store';

const navigation = [
    { name: 'Browse Contests', href: '/contests' },
    { name: 'For Organizers', href: '/#organizers' },
    { name: 'Ambassador Program', href: '/ambassador' },
];

export function Header() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <nav className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                {/* Logo */}
                <Link href="/" className="flex items-center">
                    <Image
                        src="/quizBuzz-logo.png"
                        alt="QuizBuzz"
                        width={140}
                        height={40}
                        priority
                        className="h-8 w-auto sm:h-9"
                    />
                </Link>

                {/* Desktop Navigation — Centered */}
                <div className="hidden md:flex items-center gap-6 lg:gap-8 absolute left-1/2 -translate-x-1/2">
                    {navigation.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {item.name}
                        </Link>
                    ))}
                </div>

                {/* Desktop CTA */}
                <div className="hidden md:flex md:items-center md:gap-3">
                    <Link href="/login">
                        <Button size="sm">
                            Organizer Sign In
                        </Button>
                    </Link>
                    <ThemeToggle />
                </div>

                {/* Mobile controls */}
                <div className="flex items-center gap-1 md:hidden">
                    <ThemeToggle />
                    <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        <span className="sr-only">Open main menu</span>
                        {mobileMenuOpen ? (
                            <X className="h-6 w-6" aria-hidden="true" />
                        ) : (
                            <Menu className="h-6 w-6" aria-hidden="true" />
                        )}
                    </button>
                </div>
            </nav>

            {/* Mobile menu */}
            {mobileMenuOpen && (
                <div className="md:hidden border-t border-border/50 bg-background">
                    <div className="space-y-1 px-4 py-3">
                        {navigation.map((item) => (
                            <Link
                                key={item.name}
                                href={item.href}
                                className="block rounded-md px-3 py-2 text-base font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                {item.name}
                            </Link>
                        ))}
                        <div className="mt-4 flex flex-col gap-2 pt-4 border-t border-border/50">
                            {showInstallBtn && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setMobileMenuOpen(false);
                                        setShowInstallPrompt(true);
                                    }}
                                    className="w-full text-primary border-primary/20 hover:bg-primary/5 flex items-center justify-center gap-1.5"
                                >
                                    <Download className="h-4 w-4" />
                                    Install App
                                </Button>
                            )}
                            <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                                <Button className="w-full">
                                    Organizer Sign In
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

