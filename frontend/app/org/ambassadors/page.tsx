'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApplicationsQueue } from '@/components/features/ambassador/ApplicationsQueue';
import { CampaignsList } from '@/components/features/ambassador/CampaignsList';

export default function AmbassadorsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ambassadors</h1>
        <p className="text-sm text-muted-foreground">Review applications and manage referral campaigns</p>
      </div>

      <Tabs defaultValue="applications">
        <TabsList>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>
        <TabsContent value="applications" className="mt-4">
          <ApplicationsQueue />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-4">
          <CampaignsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
