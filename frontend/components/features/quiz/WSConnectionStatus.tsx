'use client';

import { type WsStatus as WSStatus } from '@/lib/hooks/useWaitingRoomSocket';

interface WSConnectionStatusProps {
  status: WSStatus;
  variant?: 'compact' | 'full';
}

export function WSConnectionStatus({
  status,
  variant = 'compact',
}: WSConnectionStatusProps) {
  const statusConfig = {
    connected: {
      color: 'bg-green-500',
      text: 'Connected',
      pulse: false,
    },
    reconnecting: {
      color: 'bg-amber-500 animate-pulse',
      text: 'Reconnecting...',
      pulse: true,
    },
    disconnected: {
      color: 'bg-red-500',
      text: 'Disconnected',
      pulse: false,
    },
  };

  const config = statusConfig[status];

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2 border border-border">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        <span className="text-sm font-medium text-foreground">{config.text}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-surface-2 border border-border">
      <div className={`w-3 h-3 rounded-full ${config.color}`} />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          WebSocket {config.text}
        </p>
        {status === 'disconnected' && (
          <p className="text-xs text-muted-foreground mt-1">
            Attempting to reconnect automatically
          </p>
        )}
      </div>
    </div>
  );
}
