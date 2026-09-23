'use client';

import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useNotificationPreferences } from '@/lib/hooks/useNotificationPreferences';
import type { NotificationPreference } from '@/lib/api/organization.api';

/**
 * Settings → Notifications. Renders whatever types the backend registry returns for this
 * admin (already filtered by role + org feature flags), grouped by category — a new
 * notification type shows up here with no frontend change. Toggles are per-member.
 */
export function NotificationsTabContent({ orgId }: { orgId: string }) {
  const { preferences, update } = useNotificationPreferences(orgId);

  const byCategory = preferences.reduce<Record<string, NotificationPreference[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  const toggle = async (type: string, email: boolean) => {
    try {
      await update({ type, email });
    } catch (err: any) {
      toast.error(err?.message || 'Could not update notification setting');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> Notifications
        </h2>
        <p className="text-sm text-muted-foreground">Choose which emails you receive for this organization. These settings only apply to you.</p>
      </div>

      {Object.entries(byCategory).map(([category, items]) => (
        <Card key={category} className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">{category}</CardTitle>
            <CardDescription>Email notifications</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border/50">
            {items.map((p) => (
              <label key={p.type} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0 cursor-pointer">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{p.label}</span>
                  <span className="block text-sm text-muted-foreground">{p.description}</span>
                </span>
                <Switch checked={p.email} onCheckedChange={(v) => toggle(p.type, v)} aria-label={`Email: ${p.label}`} />
              </label>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
