'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, FileText, Award, User, Zap } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/contests', label: 'Contests', icon: Zap },
  { href: '/dashboard/results', label: 'Results', icon: FileText },
  { href: '/dashboard/certificates', label: 'Certificates', icon: Award },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const isParticipantRoute = pathname.startsWith('/dashboard');

  if (!isParticipantRoute) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-background md:hidden safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              className={cn(
                'flex flex-col items-center justify-center w-full h-full gap-1 text-xs transition-colors',
                'touch-target', // Ensures 44x44px minimum touch area
                isActive
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// CSS to be added to globals.css
export const mobileNavStyles = `
.touch-target {
  min-width: 44px;
  min-height: 44px;
}

.safe-area-inset-bottom {
  padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
}
`;
