'use client';

import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { useProctoringStore } from '@/lib/stores/proctoring-store';
import { useFaceDetection } from '@/lib/proctoring/useFaceDetection';

// ═══════════════════════════════════════════════════════
// ProctoringManager — Side-effect component
// ═══════════════════════════════════════════════════════

interface ProctoringManagerProps {
  emitProctoringWarning: (type: string) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function ProctoringManager({
  emitProctoringWarning,
  videoRef,
}: ProctoringManagerProps) {
  const [showFullscreenRequest, setShowFullscreenRequest] = useState(false);
  const store = useProctoringStore();

  // 1. REQUEST + ENFORCE FULLSCREEN
  useEffect(() => {
    const requestFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          store.setFullscreen(true);
        }
      } catch {
        setShowFullscreenRequest(true);
      }
    };
    
    // Attempt fullscreen on mount
    requestFullscreen();

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      if (!isCurrentlyFullscreen && store.isFullscreen) {
        store.addWarning({ type: 'FULLSCREEN_EXIT', timestamp: Date.now() });
        emitProctoringWarning('FULLSCREEN_EXIT');
      }
      store.setFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [emitProctoringWarning, store]);

  // 2. TAB SWITCH DETECTION
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        store.addWarning({ type: 'TAB_SWITCH', timestamp: Date.now() });
        emitProctoringWarning('TAB_SWITCH');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [emitProctoringWarning, store]);

  // 3. COPY / PASTE PREVENTION
  useEffect(() => {
    const prevent = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.warning('Copy-paste is disabled during this quiz');
    };
    document.addEventListener('copy', prevent);
    document.addEventListener('cut', prevent);
    document.addEventListener('paste', prevent);
    return () => {
      document.removeEventListener('copy', prevent);
      document.removeEventListener('cut', prevent);
      document.removeEventListener('paste', prevent);
    };
  }, []);

  // 4. RIGHT-CLICK PREVENTION
  useEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', prevent);
    return () => document.removeEventListener('contextmenu', prevent);
  }, []);

  // 5. KEYBOARD SHORTCUTS PREVENTION
  useEffect(() => {
    const prevent = (e: KeyboardEvent) => {
      // Block: Ctrl+C, Ctrl+V, Ctrl+U (view source), F12 (devtools), Ctrl+Shift+I, Ctrl+A
      const key = e.key.toLowerCase();
      if (
        (e.ctrlKey && ['c', 'v', 'u', 'a'].includes(key)) ||
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && key === 'i')
      ) {
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', prevent);
    return () => document.removeEventListener('keydown', prevent);
  }, []);

  // 5. CAMERA STREAM
  // On mount: check if stream already exists in store (from entry page)
  // Only request if not already granted (handles direct navigation to /live)
  useEffect(() => {
    const storeState = useProctoringStore.getState();
    if (!storeState.videoStream || storeState.cameraStatus !== 'active') {
      storeState.requestCameraPermission();
    }
  }, []);

  // Attach stream to videoRef if provided
  useEffect(() => {
    const { videoStream } = useProctoringStore.getState();
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch(() => {}); // autoplay policy
    }
  }, [videoRef]);

  // 6. FACE DETECTION
  // We wrap the emit to match the expected signature in useFaceDetection
  const wrappedEmit = (event: string, data: Record<string, unknown>) => {
    if (event === 'PROCTOR_WARNING' && typeof data.warningType === 'string') {
      emitProctoringWarning(data.warningType);
    }
  };

  useFaceDetection({ 
    videoRef, 
    active: true, 
    wsEmit: wrappedEmit 
  });

  return null;
}
