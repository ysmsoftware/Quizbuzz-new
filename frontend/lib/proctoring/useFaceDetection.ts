'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useProctoringStore } from '@/lib/stores/proctoring-store';
import type { DetectionResult } from './types';
import type { FaceDetectionEngine } from './FaceDetectionEngine';

interface UseFaceDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  active: boolean;
  wsEmit?: (event: string, data: Record<string, unknown>) => void;
}

export function useFaceDetection({ videoRef, active, wsEmit }: UseFaceDetectionProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const engineRef = useRef<FaceDetectionEngine | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Timestamp-based tracking for continuous violations
  const noFaceStartRef = useRef<number | null>(null);
  const multiFaceStartRef = useRef<number | null>(null);

  // Selectors for store (avoid re-renders from unrelated state changes)
  const faceCount = useProctoringStore((s) => s.faceCount);
  const faceDetected = useProctoringStore((s) => s.faceDetected);
  const lightingOk = useProctoringStore((s) => s.lightingOk);

  // Initialize model on first mount when active
  useEffect(() => {
    if (!active || isInitialized) return;

    const initModel = async () => {
      try {
        const { faceEngine } = await import('./index');
        engineRef.current = faceEngine;
        await faceEngine.loadModel();
        setIsInitialized(true);
      } catch (error) {
        console.error('[QuizPro] Failed to initialize face detection:', error);
      }
    };

    initModel();
  }, [active, isInitialized]);

  // Handle detection result — update store and check for violations
  const handleResult = useCallback(
    (result: DetectionResult) => {
      const store = useProctoringStore.getState();
      store.setFaceCount(result.faceCount);
      store.setFaceDetected(result.faceCount === 1);
      store.setLightingOk(result.lightingOk);

      // NO FACE for > 5 continuous seconds
      if (result.faceCount === 0) {
        if (!noFaceStartRef.current) {
          noFaceStartRef.current = Date.now();
        } else if (Date.now() - noFaceStartRef.current > 5000) {
          store.addWarning({ type: 'NO_FACE', timestamp: Date.now() });
          wsEmit?.('PROCTOR_WARNING', {
            warningType: 'NO_FACE',
            timestamp: Date.now(),
          });
          noFaceStartRef.current = null; // Reset to avoid spam
        }
      } else {
        noFaceStartRef.current = null;
      }

      // MULTIPLE FACES for > 3 continuous seconds
      if (result.faceCount >= 2) {
        if (!multiFaceStartRef.current) {
          multiFaceStartRef.current = Date.now();
        } else if (Date.now() - multiFaceStartRef.current > 3000) {
          store.addWarning({ type: 'MULTIPLE_FACES', timestamp: Date.now() });
          wsEmit?.('PROCTOR_WARNING', {
            warningType: 'MULTIPLE_FACES',
            timestamp: Date.now(),
          });
          multiFaceStartRef.current = null;
        }
      } else {
        multiFaceStartRef.current = null;
      }
    },
    [wsEmit]
  );

  // Main detection loop — uses setTimeout (not setInterval) to prevent stacking
  const runDetection = useCallback(async () => {
    if (!videoRef.current || !engineRef.current?.isReady()) {
      timeoutRef.current = window.setTimeout(runDetection, 2000);
      return;
    }

    try {
      const result = await engineRef.current.detect(videoRef.current);
      handleResult(result);
    } catch (error) {
      console.error('[QuizPro] Detection error:', error);
    }

    // Schedule next detection (every 2 seconds)
    timeoutRef.current = window.setTimeout(runDetection, 2000);
  }, [videoRef, handleResult]);

  // Start/stop detection based on active + initialized
  useEffect(() => {
    if (active && isInitialized) {
      // Start detection after short delay for video to stabilize
      timeoutRef.current = window.setTimeout(runDetection, 500);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [active, isInitialized, runDetection]);

  return {
    isInitialized,
    faceCount,
    faceDetected,
    lightingOk,
  };
}
