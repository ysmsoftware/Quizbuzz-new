'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, TrendingDown, Flag, Users } from 'lucide-react';
import type { LiveParticipant } from '@/lib/hooks/useAdminContestSocket';
import { motion, AnimatePresence } from 'framer-motion';

interface RankedOutliersSectionProps {
  participants: LiveParticipant[];
  totalParticipants: number;
}

type FilterTab = 'all' | 'leaders' | 'laggers' | 'flagged';

export function RankedOutliersSection({ participants, totalParticipants }: RankedOutliersSectionProps) {
  const [filterTab, setFilterTab] = useState<FilterTab>('leaders');

  const rankedData = useMemo(() => {
    const active = participants.filter(p => p.status !== 'disconnected' && p.status !== 'submitted');
    
    if (filterTab === 'leaders') {
      return active
        .sort((a, b) => b.estimatedScorePercent - a.estimatedScorePercent || b.answeredCount - a.answeredCount)
        .slice(0, 5);
    } else if (filterTab === 'laggers') {
      return active
        .filter(p => p.status === 'active')
        .sort((a, b) => a.answeredCount - b.answeredCount || a.estimatedScorePercent - b.estimatedScorePercent)
        .slice(0, 5);
    } else if (filterTab === 'flagged') {
      return participants
        .filter(p => p.status === 'flagged')
        .sort((a, b) => b.proctoringAlerts - a.proctoringAlerts)
        .slice(0, 5);
    } else {
      // 'all' - top performers overall
      return participants
        .sort((a, b) => b.estimatedScorePercent - a.estimatedScorePercent || b.answeredCount - a.answeredCount)
        .slice(0, 10);
    }
  }, [participants, filterTab]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-700 border-green-200';
      case 'submitted':
        return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'flagged':
        return 'bg-red-500/10 text-red-700 border-red-200';
      case 'disconnected':
        return 'bg-gray-500/10 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'submitted':
        return 'Submitted';
      case 'flagged':
        return 'Flagged';
      case 'disconnected':
        return 'Disconnected';
      default:
        return status;
    }
  };

  return (
    <Card className="col-span-1 lg:col-span-1 flex flex-col h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Ranked Outliers
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Showing top {rankedData.length} of {totalParticipants}
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as FilterTab)} className="mt-4">
          <TabsList className="h-8 bg-muted w-full grid grid-cols-4">
            <TabsTrigger value="all" className="text-xs h-8">
              All
            </TabsTrigger>
            <TabsTrigger value="leaders" className="text-xs h-8">
              Leaders
            </TabsTrigger>
            <TabsTrigger value="laggers" className="text-xs h-8 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              Laggers
            </TabsTrigger>
            <TabsTrigger value="flagged" className="text-xs h-8 flex items-center gap-1">
              <Flag className="w-3 h-3" />
              Flagged
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {rankedData.length > 0 ? (
              rankedData.map((participant, index) => {
                const initials = participant.name
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <motion.div
                    key={participant.participantId}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className={`p-3 rounded-lg border ${getStatusColor(participant.status)} transition-all hover:shadow-md`}
                  >
                    {/* Rank + Name + Avatar */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold w-6 text-center">
                          #{index + 1}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{participant.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {participant.estimatedScorePercent}% • {participant.answeredCount}/{participant.totalQuestions} Q
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(participant.status)} variant="outline">
                        {getStatusLabel(participant.status)}
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{Math.round((participant.answeredCount / participant.totalQuestions) * 100)}%</span>
                      </div>
                      <Progress
                        value={(participant.answeredCount / participant.totalQuestions) * 100}
                        className="h-1.5"
                      />
                    </div>

                    {/* Time Remaining */}
                    {participant.timeRemainingSeconds > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        ⏱️ {Math.floor(participant.timeRemainingSeconds / 60)}m {participant.timeRemainingSeconds % 60}s remaining
                      </p>
                    )}

                    {/* Alerts */}
                    {participant.proctoringAlerts > 0 && (
                      <p className="text-xs text-red-600 font-medium mt-2">
                        ⚠️ {participant.proctoringAlerts} alert{participant.proctoringAlerts > 1 ? 's' : ''}
                      </p>
                    )}
                  </motion.div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <div className="text-center">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No participants in this category</p>
                </div>
              </div>
            )}
          </div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
