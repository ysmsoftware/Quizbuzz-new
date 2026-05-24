'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';

/**
 * Minimal header for public contest/quiz flows — no admin Sign In / Create Account.
 */
export function PublicHeader() {
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
        <Link
          href="/contests"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Browse Contests
        </Link>
      </nav>
    </header>
  );
}
