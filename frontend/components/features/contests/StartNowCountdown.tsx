'use client';

import { useEffect, useState } from 'react';

interface StartNowCountdownProps {
  startTime: string;
}

/**
 * Compact sibling of WaitingRoomCountdown.tsx for the admin toolbar — same
 * tick-every-second logic, sized down to a single "Starts in 04:32" line instead of
 * the full-screen days/hours/minutes/seconds boxes.
 */
export function StartNowCountdown({ startTime }: StartNowCountdownProps) {
  const [label, setLabel] = useState('00:00');

  useEffect(() => {
    const update = () => {
      const remaining = Math.max(0, new Date(startTime).getTime() - Date.now());
      const totalSeconds = Math.floor(remaining / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const mm = String(minutes).padStart(2, '0');
      const ss = String(seconds).padStart(2, '0');
      setLabel(hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span className="text-xs font-mono font-semibold text-amber-600 tabular-nums">
      Starts in {label}
    </span>
  );
}
