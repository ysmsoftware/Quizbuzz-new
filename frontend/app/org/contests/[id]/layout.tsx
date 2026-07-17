'use client';

import { AdminContestDetailShell } from './index';

export default function ContestDetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminContestDetailShell>
      {children}
    </AdminContestDetailShell>
  );
}
