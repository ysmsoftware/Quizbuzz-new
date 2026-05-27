"use client";

import { PublicHeader } from '@/components/layout/public-header';
import { usePathname } from 'next/navigation';

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPlayPage = pathname?.endsWith('/play');

  return (
    <div className="flex min-h-screen flex-col">
      {!isPlayPage && <PublicHeader />}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}

