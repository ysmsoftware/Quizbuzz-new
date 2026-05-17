'use client';

import { Trophy, Medal, Award } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Contest } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';

interface PrizeBracketProps {
  prizes: Contest['prizes'];
  className?: string;
}

export function ContestPrizeBracket({ prizes, className }: PrizeBracketProps) {
  if (!prizes || prizes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl bg-muted/20">
        <Award className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground">No prize structure defined for this contest.</p>
      </div>
    );
  }

  const sortedPrizes = [...prizes].sort((a, b) => {
    const rankA = typeof a.rank === 'number' ? a.rank : parseInt(String(a.rank));
    const rankB = typeof b.rank === 'number' ? b.rank : parseInt(String(b.rank));
    return rankA - rankB;
  });
  const podiumPrizes = sortedPrizes.filter(p => {
    const rankNum = typeof p.rank === 'number' ? p.rank : parseInt(String(p.rank));
    return rankNum <= 3;
  });
  const otherPrizes = sortedPrizes.filter(p => {
    const rankNum = typeof p.rank === 'number' ? p.rank : parseInt(String(p.rank));
    return rankNum > 3;
  });

  // Reorder for podium display: 2, 1, 3
  const displayPodium = [
    podiumPrizes.find(p => {
      const rankNum = typeof p.rank === 'number' ? p.rank : parseInt(String(p.rank));
      return rankNum === 2;
    }),
    podiumPrizes.find(p => {
      const rankNum = typeof p.rank === 'number' ? p.rank : parseInt(String(p.rank));
      return rankNum === 1;
    }),
    podiumPrizes.find(p => {
      const rankNum = typeof p.rank === 'number' ? p.rank : parseInt(String(p.rank));
      return rankNum === 3;
    }),
  ].filter(Boolean);

  return (
    <div className={cn("space-y-8", className)}>
      {/* Podium Display */}
      <div className="grid grid-cols-3 items-end gap-2 sm:gap-6 pt-10">
        {displayPodium.map((prize, index) => {
          if (!prize) return null;
          
          const rankNum = typeof prize.rank === 'number' ? prize.rank : parseInt(String(prize.rank));
          const isFirst = rankNum === 1;
          const isSecond = rankNum === 2;
          const isThird = rankNum === 3;

          return (
            <motion.div
              key={rankNum}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center"
            >
              <div className={cn(
                "relative flex flex-col items-center w-full rounded-t-2xl pt-8 pb-6 px-2 text-center",
                isFirst ? "bg-primary/10 border-x-2 border-t-2 border-primary/20 h-48" : 
                isSecond ? "bg-muted/50 border-x border-t border-border/50 h-40" : 
                "bg-muted/30 border-x border-t border-border/30 h-32"
              )}>
                <div className={cn(
                  "absolute -top-10 flex h-14 w-14 items-center justify-center rounded-full shadow-lg border-4 border-background",
                  isFirst ? "bg-yellow-500" : isSecond ? "bg-slate-400" : "bg-amber-600"
                )}>
                  {isFirst ? (
                    <Trophy className="h-7 w-7 text-white" />
                  ) : (
                    <Medal className="h-7 w-7 text-white" />
                  )}
                </div>
                
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  {rankNum}{rankNum === 1 ? 'st' : rankNum === 2 ? 'nd' : 'rd'} Place
                </span>
                <span className={cn(
                  "font-bold truncate w-full px-2",
                  isFirst ? "text-xl sm:text-2xl text-primary" : "text-lg text-foreground"
                )}>
                  {prize.amount ? `₹${prize.amount.toLocaleString()}` : prize.title}
                </span>
                {prize.description && (
                  <span className="text-[10px] sm:text-xs text-muted-foreground mt-1 line-clamp-2">
                    {prize.description}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Table Display for 4th+ */}
      {otherPrizes.length > 0 && (
        <Card className="overflow-hidden border-border/50">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground w-20">Rank</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reward</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {otherPrizes.map((prize) => (
                  <tr key={String(prize.rank)} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-semibold text-muted-foreground">
                      {prize.rank}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {prize.amount ? `₹${prize.amount.toLocaleString()}` : prize.title}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {prize.description || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
