'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsTab } from './SettingsTab';
import { StructureTab } from './StructureTab';
import { RewardsTab } from './RewardsTab';
import { LeaderboardsTab } from './LeaderboardsTab';
import { TimelineTab } from './TimelineTab';
import { KitTab } from './KitTab';
import type { CampaignResult } from '@/lib/types/ambassador';

export type ManageTabKey = 'settings' | 'structure' | 'rewards' | 'leaderboards' | 'timeline' | 'kit';

/** The tabbed campaign-editing surface — each tab enforces the same status-gated field locks
 *  as the backend (see campaign-field-locks.ts), so editing here never means "everything's
 *  always editable." Shared between the standalone /manage page (deep links, bookmarks) and
 *  the "Edit Campaign" drawer on the Overview page — same editor, two entry points. */
export function CampaignManagePanel({
  campaign,
  activeTab,
  onTabChange,
}: {
  campaign: CampaignResult;
  activeTab: ManageTabKey;
  onTabChange: (tab: ManageTabKey) => void;
}) {
  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as ManageTabKey)}>
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="structure">Structure</TabsTrigger>
        <TabsTrigger value="rewards">Rewards</TabsTrigger>
        <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="kit">Ambassador Kit</TabsTrigger>
      </TabsList>
      <TabsContent value="settings" className="mt-4">
        <SettingsTab campaign={campaign} />
      </TabsContent>
      <TabsContent value="structure" className="mt-4">
        <StructureTab campaign={campaign} />
      </TabsContent>
      <TabsContent value="rewards" className="mt-4">
        <RewardsTab campaign={campaign} />
      </TabsContent>
      <TabsContent value="leaderboards" className="mt-4">
        <LeaderboardsTab campaign={campaign} />
      </TabsContent>
      <TabsContent value="timeline" className="mt-4">
        <TimelineTab campaign={campaign} />
      </TabsContent>
      <TabsContent value="kit" className="mt-4">
        <KitTab campaign={campaign} />
      </TabsContent>
    </Tabs>
  );
}
