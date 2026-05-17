'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface TimeUnit {
  label: string;
  value: number;
}

interface WaitingRoomCountdownProps {
  startTime: string;
  onCountdownComplete?: () => void;
}

export function WaitingRoomCountdown({
  startTime,
  onCountdownComplete,
}: WaitingRoomCountdownProps) {
  const [timeUnits, setTimeUnits] = useState<TimeUnit[]>([
    { label: 'Days', value: 0 },
    { label: 'Hours', value: 0 },
    { label: 'Minutes', value: 0 },
    { label: 'Seconds', value: 0 },
  ]);

  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const remaining = Math.max(0, start - now);

      if (remaining === 0) {
        setIsComplete(true);
        onCountdownComplete?.();
        return;
      }

      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((remaining / (1000 * 60)) % 60);
      const seconds = Math.floor((remaining / 1000) % 60);

      setTimeUnits([
        { label: 'Days', value: days },
        { label: 'Hours', value: hours },
        { label: 'Minutes', value: minutes },
        { label: 'Seconds', value: seconds },
      ]);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [startTime, onCountdownComplete]);

  return (
    <div className="flex justify-center gap-4 flex-wrap">
      {timeUnits.map((unit, index) => (
        <motion.div
          key={unit.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="flex flex-col items-center"
        >
          {/* Time Box */}
          <motion.div
            key={`${unit.label}-${unit.value}`}
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className="min-w-20 px-4 py-3 rounded-lg bg-surface border border-border flex items-center justify-center"
          >
            <span className="text-4xl md:text-5xl font-mono font-bold text-foreground">
              {String(unit.value).padStart(2, '0')}
            </span>
          </motion.div>

          {/* Label */}
          <span className="text-xs text-muted-foreground mt-2 font-medium">
            {unit.label}
          </span>

          {/* Separator (except last) */}
          {index < timeUnits.length - 1 && (
            <span className="text-foreground/30 font-bold mx-2 hidden md:inline">
              :
            </span>
          )}
        </motion.div>
      ))}
    </div>
  );
}
