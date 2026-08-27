'use client';

import { cn } from '@/lib/utils';

interface AmbassadorAvatarProps {
  firstName: string;
  lastName?: string | null;
  profileImageUrl?: string | null;
  /** Pixel size — same value drives width, height, and font size so every call site stays
   *  circular and proportioned without hand-tuning text size per usage. */
  size?: number;
  className?: string;
}

/** The one place a real uploaded photo vs. the gradient-initials fallback is decided —
 *  used in the nav, dashboard identity hero, and profile page so all three stay in sync
 *  (same circular crop, same fallback) instead of three hand-rolled avatar treatments. */
export function AmbassadorAvatar({ firstName, lastName, profileImageUrl, size = 40, className }: AmbassadorAvatarProps) {
  const initials = `${firstName.charAt(0)}${lastName?.charAt(0) ?? ''}`.toUpperCase();

  if (profileImageUrl) {
    return (
      <img
        src={profileImageUrl}
        alt={`${firstName} ${lastName ?? ''}`.trim()}
        className={cn('rounded-full object-cover shrink-0 border border-border/50', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-br from-primary to-chart-2 text-primary-foreground font-bold flex items-center justify-center shrink-0',
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
