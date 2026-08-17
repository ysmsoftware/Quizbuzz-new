'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { LayoutDashboard, Megaphone, User, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAmbassadorLogout } from '@/lib/hooks/useAmbassadorLogout';

const NAV_ITEMS = [
  { label: 'Overview', href: '/ambassador/dashboard', icon: LayoutDashboard },
  { label: 'My Campaigns', href: '/ambassador/dashboard/campaigns', icon: Megaphone },
  { label: 'My Profile', href: '/ambassador/dashboard/profile', icon: User },
];

function isActive(pathname: string, href: string) {
  if (href === '/ambassador/dashboard') return pathname === href;
  return pathname.startsWith(href);
}

export function AmbassadorNav({ firstName, pathname }: { firstName: string | null; pathname: string }) {
  const { logout, isLoggingOut } = useAmbassadorLogout();

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        <Link href="/ambassador/dashboard" className="font-bold text-foreground shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          QuizBuzz
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="ambassadorNavActivePill"
                    className="absolute inset-0 rounded-lg bg-primary/10"
                    transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                  />
                )}
                {!active && <span className="absolute inset-0 rounded-lg hover:bg-secondary/40" />}
                <Icon className="relative h-4 w-4 shrink-0" />
                <span className="relative hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Account menu"
            className="flex items-center gap-2 shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {firstName === null ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              <span className="hidden sm:inline text-sm text-muted-foreground">{firstName}</span>
            )}
            <User className="h-5 w-5 text-muted-foreground sm:hidden" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={isLoggingOut} onClick={() => logout()}>
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? 'Logging out…' : 'Log out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
