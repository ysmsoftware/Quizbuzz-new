"use client";

import { PublicHeader } from '@/components/layout/public-header';
import { usePathname } from 'next/navigation';

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // These screens render their own minimal "secure portal" header inline
  // (proctored quiz-taking + the pre-quiz waiting room) — showing the
  // generic public site header (with "Browse Contests" / "Install App")
  // on top of / behind it here would be a duplicate, off-brand header.
  const hasOwnHeader = pathname?.endsWith('/play') || pathname?.endsWith('/waiting');

  return (
    <div className="flex min-h-screen flex-col">
      {!hasOwnHeader && <PublicHeader />}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}

