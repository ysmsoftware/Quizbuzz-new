'use client';

import { Trophy, Medal } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import type { QuizResult } from '@/lib/types';

interface LeaderboardPodiumProps {
  topThree: any[]; // Using any temporarily or I should import LeaderboardEntry
}

export function LeaderboardPodium({ topThree }: LeaderboardPodiumProps) {
  const getInitials = (firstName: string, lastName: string) => {
    return (firstName[0] + lastName[0]).toUpperCase();
  };

  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'from-yellow-400 to-yellow-600';
      case 2:
        return 'from-gray-300 to-gray-500';
      case 3:
        return 'from-orange-400 to-orange-600';
      default:
        return 'from-gray-300 to-gray-400';
    }
  };

  const getMedalIcon = (rank: number) => {
    if (rank === 1) {
      return <Trophy className="h-5 w-5 text-yellow-600" />;
    }
    return <Medal className="h-5 w-5 text-gray-700" />;
  };

  // Arrange for podium: 2nd, 1st, 3rd
  const podiumOrder = [topThree[1], topThree[0], topThree[2]];
  const heights = ['h-40', 'h-56', 'h-32'];
  const positionText = ['2nd', '1st', '3rd'];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-center gap-6 min-h-96">
        {podiumOrder.map((result, idx) => {
          const rank = [2, 1, 3][idx];
          const isDisplayed = !!result;

          return (
            <motion.div
              key={`podium-${idx}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.2 }}
              className="flex flex-col items-center"
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="mb-4 relative"
              >
                <div
                  className={`w-20 h-20 rounded-full bg-gradient-to-br ${getMedalColor(
                    rank
                  )} flex items-center justify-center text-white font-bold text-2xl shadow-xl border-4 border-background`}
                >
                  {isDisplayed ? getInitials(result.participant.contact.firstName, result.participant.contact.lastName) : '-'}
                </div>
                <div className="absolute -top-2 -right-2 bg-background rounded-full p-1 shadow-md">{getMedalIcon(rank)}</div>
              </motion.div>

              {isDisplayed && (
                <Card className={`w-48 ${heights[idx]} rounded-3xl overflow-hidden shadow-lg border-border/50`}>
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div>
                      <div className="text-[10px] font-black text-center text-amber-600 mb-2 uppercase tracking-widest">
                        {positionText[idx]} PLACE
                      </div>
                      <p className="font-bold text-center text-sm truncate">
                        {result.participant.contact.firstName} {result.participant.contact.lastName}
                      </p>
                      <p className="text-[10px] text-muted-foreground text-center font-mono">
                        {result.participant.registrationRef}
                      </p>
                    </div>

                    <div className="text-center space-y-1">
                      <div className="text-2xl font-black text-primary">{result.score}</div>
                      <div className="text-xs font-bold text-green-600">
                        {result.percentage}% Accuracy
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
