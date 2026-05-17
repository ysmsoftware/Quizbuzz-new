'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, AlertTriangle, Info, Zap, X } from 'lucide-react';
import type { LiveParticipant } from '@/lib/hooks/useAdminContestSocket';
import { motion, AnimatePresence } from 'framer-motion';

export interface AnomalyEvent {
  id: string;
  type: 'disconnect' | 'duplicate-session' | 'integrity-violation' | 'auto-flagged' | 'anomalous-behavior' | 'mass-submit';
  severity: 'critical' | 'warning' | 'info';
  participantId?: string;
  participantName?: string;
  description: string;
  timestamp: string;
  actionRequired?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

interface AnomalyFeedSectionProps {
  participants: LiveParticipant[];
  events: AnomalyEvent[];
}

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

export function AnomalyFeedSection({ participants, events }: AnomalyFeedSectionProps) {
  const [filterTab, setFilterTab] = useState<SeverityFilter>('all');
  const [dismissedEvents, setDismissedEvents] = useState<Set<string>>(new Set());

  // Generate synthetic events from participant data for demo
  const generatedEvents = useMemo(() => {
    const synthetic: AnomalyEvent[] = [];

    // Check for recent disconnects
    const disconnected = participants.filter(p => p.status === 'disconnected');
    if (disconnected.length > 0) {
      synthetic.push({
        id: `disconnect-${Date.now()}`,
        type: 'disconnect',
        severity: 'warning',
        description: `${disconnected.length} user${disconnected.length > 1 ? 's' : ''} disconnected in last 30s`,
        timestamp: new Date().toISOString(),
        actionRequired: true,
        actionLabel: 'Check Network',
      });
    }

    // Check for high proctoring alerts
    const flagged = participants.filter(p => p.proctoringAlerts > 2);
    if (flagged.length > 0) {
      flagged.slice(0, 2).forEach((p) => {
        synthetic.push({
          id: `flagged-${p.participantId}`,
          type: 'auto-flagged',
          severity: 'critical',
          participantId: p.participantId,
          participantName: p.name,
          description: `${p.name} - ${p.proctoringAlerts} proctoring alerts detected`,
          timestamp: new Date().toISOString(),
          actionRequired: true,
          actionLabel: 'Review',
        });
      });
    }

    // Check for users taking too long on a question
    const slowUsers = participants.filter(p => p.timeOnQuestion > 300 && p.status === 'active');
    if (slowUsers.length > 0) {
      slowUsers.slice(0, 1).forEach((p) => {
        synthetic.push({
          id: `slow-${p.participantId}`,
          type: 'anomalous-behavior',
          severity: 'info',
          participantId: p.participantId,
          participantName: p.name,
          description: `${p.name} - Spending ${Math.floor(p.timeOnQuestion / 60)}m on single question`,
          timestamp: new Date().toISOString(),
        });
      });
    }

    return synthetic;
  }, [participants]);

  const allEvents = [...events, ...generatedEvents];

  const filteredEvents = useMemo(() => {
    return allEvents
      .filter(e => !dismissedEvents.has(e.id))
      .filter(e => filterTab === 'all' || e.severity === filterTab)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [allEvents, filterTab, dismissedEvents]);

  const dismissEvent = (id: string) => {
    setDismissedEvents(prev => new Set([...prev, id]));
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 border-red-200';
      case 'warning':
        return 'bg-amber-500/10 border-amber-200';
      case 'info':
        return 'bg-blue-500/10 border-blue-200';
      default:
        return 'bg-gray-500/10 border-gray-200';
    }
  };

  const eventCount = {
    all: filteredEvents.length,
    critical: allEvents.filter(e => e.severity === 'critical' && !dismissedEvents.has(e.id)).length,
    warning: allEvents.filter(e => e.severity === 'warning' && !dismissedEvents.has(e.id)).length,
    info: allEvents.filter(e => e.severity === 'info' && !dismissedEvents.has(e.id)).length,
  };

  return (
    <Card className="col-span-1 lg:col-span-1 flex flex-col h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Anomaly Feed
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} • Updates every 3s
            </p>
          </div>
        </div>

        {/* Severity Filter Tabs */}
        <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as SeverityFilter)} className="mt-4">
          <TabsList className="h-8 bg-muted w-full grid grid-cols-4">
            <TabsTrigger value="all" className="text-xs h-8">
              All ({eventCount.all})
            </TabsTrigger>
            <TabsTrigger value="critical" className="text-xs h-8">
              <span className="text-red-600">●</span> Critical
            </TabsTrigger>
            <TabsTrigger value="warning" className="text-xs h-8">
              <span className="text-amber-600">●</span> Warnings
            </TabsTrigger>
            <TabsTrigger value="info" className="text-xs h-8">
              <span className="text-blue-600">●</span> Info
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className={`p-3 rounded-lg border ${getSeverityColor(event.severity)} flex items-start gap-3 hover:shadow-md transition-shadow group`}
              >
                {/* Severity Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {getSeverityIcon(event.severity)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground line-clamp-2">
                    {event.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getTimeAgo(new Date(event.timestamp))}
                  </p>

                  {/* Action Button */}
                  {event.actionRequired && event.actionLabel && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 text-xs"
                      onClick={event.onAction}
                    >
                      {event.actionLabel}
                    </Button>
                  )}
                </div>

                {/* Dismiss Button */}
                <button
                  onClick={() => dismissEvent(event.id)}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Dismiss"
                >
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              </motion.div>
            ))
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <div className="text-center">
                <div className="text-lg mb-2">✓</div>
                <p className="text-sm">No {filterTab !== 'all' ? filterTab : 'anomalous'} events</p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
