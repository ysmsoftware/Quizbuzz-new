'use client';

import { type WsStatus as WSStatus } from '@/lib/stores/quiz-store';

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
      color: 'bg-success',
      text: 'Connected',
      pulse: false,
    },
    reconnecting: {
      color: 'bg-warning animate-pulse',
      text: 'Reconnecting...',
      pulse: true,
    },
    disconnected: {
      color: 'bg-destructive',
      text: 'Disconnected',
      pulse: false,
    },
  };

  const config = statusConfig[status];

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        <span className="text-sm font-medium text-foreground">{config.text}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted border border-border">
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
