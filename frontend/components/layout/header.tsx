'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, X, ChevronDown, Trophy, BookOpen, Users, HelpCircle, Download } from 'lucide-react';
import { usePwaStore } from '@/lib/stores/pwa-store';

const navigation = [
    { name: 'Browse Contests', href: '/contests', icon: Trophy },
    { name: 'How It Works', href: '/#how-it-works', icon: HelpCircle },
    { name: 'For Organizers', href: '/#organizers', icon: Users },
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
            <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                        <BookOpen className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">
                        Quiz<span className="text-primary">Buzz</span>
                    </span>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex md:items-center md:gap-1">
                    {navigation.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                            <item.icon className="h-4 w-4" />
                            {item.name}
                        </Link>
                    ))}
                </div>

                {/* Desktop CTA */}
                <div className="hidden md:flex md:items-center md:gap-3">
                    {showInstallBtn && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowInstallPrompt(true)}
                            className="text-primary font-medium hover:text-primary hover:bg-secondary flex items-center gap-1.5 mr-1"
                        >
                            <Download className="h-4 w-4" />
                            Install App
                        </Button>
                    )}
                    <Link href="/login">
                        <Button variant="outline" size="sm">
                            Sign In
                        </Button>
                    </Link>
                    <Link href="/register">
                        <Button size="sm">
                            Create Account
                        </Button>
                    </Link>
                </div>

                {/* Mobile menu button */}
                <button
                    type="button"
                    className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    <span className="sr-only">Open main menu</span>
                    {mobileMenuOpen ? (
                        <X className="h-6 w-6" aria-hidden="true" />
                    ) : (
                        <Menu className="h-6 w-6" aria-hidden="true" />
                    )}
                </button>
            </nav>

            {/* Mobile menu */}
            {mobileMenuOpen && (
                <div className="md:hidden border-t border-border/50 bg-background">
                    <div className="space-y-1 px-4 py-3">
                        {navigation.map((item) => (
                            <Link
                                key={item.name}
                                href={item.href}
                                className="flex items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                <item.icon className="h-5 w-5" />
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
                                <Button variant="outline" className="w-full">
                                    Sign In
                                </Button>
                            </Link>
                            <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                                <Button className="w-full">
                                    Create Account
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

