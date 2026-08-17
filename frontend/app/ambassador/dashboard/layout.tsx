'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useAmbassadorMe } from '@/lib/hooks/useAmbassadorMe';
import { AmbassadorNav } from '@/components/features/ambassador/AmbassadorNav';

export default function AmbassadorDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ambassador, isLoading, isError } = useAmbassadorMe();

  useEffect(() => {
    if (isError) router.replace('/ambassador/login');
  }, [isError, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-14 border-b border-border/40 px-4 sm:px-6 lg:px-8 flex items-center">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="px-4 py-6 max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!ambassador) return null;

  return (
    <div className="min-h-screen bg-background">
      <AmbassadorNav firstName={ambassador.firstName} pathname={pathname} />
      {children}
    </div>
  );
}
