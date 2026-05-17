'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Expand } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProctoringStore } from '@/lib/stores/proctoring-store';
import { ProctoringStatusChip } from './ProctoringStatusChip';

interface CameraFeedProps {
  stream: MediaStream | null;
  variant?: 'floating' | 'mini' | 'topbar' | 'topbar-large' | 'panel';
  showStatus?: boolean;
  onExpand?: () => void;
}

export function CameraFeed({
  stream,
  variant = 'floating',
  showStatus = false,
  onExpand,
}: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showExpandModal, setShowExpandModal] = useState(false);
  const isCameraEnabled = useProctoringStore((s) => s.isCameraEnabled);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.play().catch((error) => {
      console.error('[QuizPro] Failed to play video:', error);
    });

    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  const handleExpand = () => {
    if (onExpand) {
      onExpand();
    } else {
      setShowExpandModal(true);
    }
  };

  const variantStyles: Record<string, string> = {
    topbar: 'w-20 h-[60px] rounded-md',
    'topbar-large': 'w-28 h-20 rounded-lg',
    floating: 'w-[90px] h-[70px] rounded-lg',
    mini: 'w-[60px] h-[60px] rounded-full',
    panel: 'w-full h-full rounded-lg',
  };

  const containerStyles: Record<string, string> = {
    topbar: '',
    'topbar-large': '',
    floating: 'fixed bottom-4 right-4 z-40',
    mini: 'fixed bottom-4 left-4 z-40',
    panel: '',
  };

  return (
    <>
      <div className={cn('flex flex-col items-center gap-1', containerStyles[variant])}>
        <button
          type="button"
          onClick={handleExpand}
          className={cn(
            'relative overflow-hidden bg-black shadow-lg border border-border/50 cursor-pointer transition-transform hover:scale-105',
            variantStyles[variant]
          )}
          aria-label="Expand camera preview"
        >
          {stream ? (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <CameraOff className="w-4 h-4 text-muted-foreground" />
            </div>
          )}

          {/* Expand icon overlay */}
          <div className="absolute top-1 right-1 opacity-0 hover:opacity-100 transition-opacity">
            <Expand className="w-3 h-3 text-white drop-shadow-md" />
          </div>
        </button>

        {/* Status label for floating variant */}
        {variant === 'floating' && (
          <div className="flex items-center gap-1 text-[10px] font-medium">
            {stream ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-600 dark:text-green-400">Camera active</span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-amber-600 dark:text-amber-400">Camera off</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Expand Modal */}
      {showExpandModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowExpandModal(false)}
        >
          <div
            className="bg-card rounded-xl shadow-2xl border p-4 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Camera Preview</span>
              </div>
              <button
                onClick={() => setShowExpandModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                Close
              </button>
            </div>

            <div className="relative overflow-hidden rounded-lg bg-black" style={{ width: '100%', height: 240 }}>
              {stream ? (
                <video
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                  ref={(el) => {
                    if (el && stream) {
                      el.srcObject = stream;
                      el.play().catch(() => {});
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <CameraOff className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="mt-3 flex justify-center">
              <ProctoringStatusChip />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
