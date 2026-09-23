'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AmbassadorDirectory } from '@/components/features/ambassador/AmbassadorDirectory';
import { ApplicationsQueue } from '@/components/features/ambassador/ApplicationsQueue';

/**
 * Ambassadors — who's part of our program (Task 10). Campaign management now lives at its
 * own peer route, /org/campaigns (see app/org/campaigns/page.tsx), so this page is purely
 * about people: the org-wide directory of approved ambassadors by default, with the
 * per-campaign application review queue as a second tab.
 */
export default function AmbassadorsPage() {
  // ?tab=applications — used by the "new ambassador application" email link.
  const [tab, setTab] = useState('directory');
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'applications' || t === 'directory') setTab(t);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ambassadors</h1>
        <p className="text-sm text-muted-foreground">Browse your ambassador directory and review applications</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
        </TabsList>
        <TabsContent value="directory" className="mt-4">
          <AmbassadorDirectory />
        </TabsContent>
        <TabsContent value="applications" className="mt-4">
          <ApplicationsQueue />
        </TabsContent>
      </Tabs>
    </div>
  );
}
