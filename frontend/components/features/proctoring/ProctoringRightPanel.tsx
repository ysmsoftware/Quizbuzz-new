'use client';

import { useProctoringStore } from '@/lib/stores/proctoring-store';
import { CameraFeed } from './CameraFeed';
import { AlertTriangle, Wifi, WifiOff, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProctoringRightPanel() {
  const videoStream = useProctoringStore((s) => s.videoStream);
  const cameraStatus = useProctoringStore((s) => s.cameraStatus);
  const totalWarnings = useProctoringStore((s) => s.totalWarnings);

  // Mock network status (in real app, use actual network monitor)
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-500';
      case 'denied':
        return 'text-red-500';
      case 'requesting':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Camera Active';
      case 'denied':
        return 'Camera Denied';
      case 'requesting':
        return 'Requesting Access';
      case 'error':
        return 'Camera Error';
      default:
        return 'Idle';
    }
  };

  return (
    <aside className="w-80 border-l border-white/5 bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col p-4 gap-4 overflow-y-auto">
      {/* Camera Feed */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Live Proctoring</h3>
        <div className="bg-slate-800/50 rounded-lg p-3 aspect-video flex items-center justify-center">
          {videoStream ? (
            <CameraFeed stream={videoStream} variant="panel" />
          ) : (
            <div className="text-center text-muted-foreground text-xs">
              <EyeOff className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p>Camera inactive</p>
            </div>
          )}
        </div>
      </div>

      {/* Status Section */}
      <div className="space-y-3 border-t border-white/5 pt-4">
        <h3 className="text-sm font-semibold text-white">Monitoring Status</h3>
        
        {/* Camera Status */}
        <div className="space-y-1 p-3 bg-slate-800/30 rounded-lg">
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full', getStatusColor(cameraStatus))} />
            <span className="text-xs font-medium text-white">Camera</span>
          </div>
          <p className={cn('text-xs', getStatusColor(cameraStatus))}>
            {getStatusLabel(cameraStatus)}
          </p>
        </div>

        {/* Connection Status */}
        <div className="space-y-1 p-3 bg-slate-800/30 rounded-lg">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className="text-xs font-medium text-white">Network</span>
          </div>
          <p className={cn('text-xs', isOnline ? 'text-green-500' : 'text-red-500')}>
            {isOnline ? 'Connected' : 'Offline'}
          </p>
        </div>

        {/* Warning Count */}
        {totalWarnings > 0 && (
          <div className="space-y-1 p-3 bg-red-950/30 rounded-lg border border-red-500/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-xs font-medium text-white">Warnings</span>
            </div>
            <p className="text-xs text-red-400">
              {totalWarnings} proctoring warning{totalWarnings > 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* System Info */}
      <div className="space-y-2 border-t border-white/5 pt-4 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Browser</span>
          <span className="text-white">{typeof window !== 'undefined' ? 'Chrome' : 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span>Screen Size</span>
          <span className="text-white">Full Screen</span>
        </div>
      </div>
    </aside>
  );
}
