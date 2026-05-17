import { create } from 'zustand';

// ============================================
// Types
// ============================================

export type WarningType =
  | 'TAB_SWITCH'
  | 'FULLSCREEN_EXIT'
  | 'MULTIPLE_FACES'
  | 'NO_FACE'
  | 'CAMERA_OFF';

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error';

export interface Warning {
  type: WarningType;
  timestamp: number;
  count: number;
}

// ============================================
// Store
// ============================================

interface ProctoringState {
  // Camera
  cameraStatus: CameraStatus;
  isCameraEnabled: boolean;
  isCameraPermissionGranted: boolean;
  videoStream: MediaStream | null;

  // Fullscreen
  isFullscreen: boolean;

  // Face detection
  faceDetected: boolean;
  faceCount: number;
  lightingOk: boolean;

  // Warnings
  warnings: Warning[];
  totalWarnings: number;
  isFlagged: boolean;

  // Warning modal UI
  showWarningModal: boolean;
  currentWarningType: WarningType | null;

  // Tab switch tracking
  tabSwitchCount: number;
  fullscreenExitCount: number;
  maxTabSwitches: number;

  // Legacy UI state
  showWarning: boolean;
  warningMessage: string;
  isDisqualified: boolean;
}

interface ProctoringActions {
  // Face detection
  setFaceDetected: (value: boolean) => void;
  setFaceCount: (value: number) => void;
  setLightingOk: (value: boolean) => void;

  // Camera
  setCameraStatus: (status: CameraStatus) => void;
  setCameraEnabled: (value: boolean) => void;
  setCameraPermissionGranted: (value: boolean) => void;
  setCameraStream: (stream: MediaStream | null) => void;
  setVideoStream: (stream: MediaStream | null) => void;
  requestCameraPermission: () => Promise<boolean>;

  // Fullscreen
  setFullscreen: (value: boolean) => void;
  setFullscreenEnabled: (value: boolean) => void;
  enterFullscreen: () => Promise<boolean>;
  exitFullscreen: () => Promise<void>;

  // Warnings
  addWarning: (warning: { type: WarningType; timestamp: number }) => void;
  dismissWarningModal: () => void;
  flagSession: () => void;

  // Tab switch
  recordTabSwitch: () => boolean;
  recordFullscreenExit: () => void;
  setMaxTabSwitches: (max: number) => void;
  setWarning: (show: boolean, message?: string) => void;

  // Reset
  reset: () => void;
}

export const useProctoringStore = create<ProctoringState & ProctoringActions>()(
  (set, get) => ({
    // ─── Initial State ──────────────────────────
    cameraStatus: 'idle',
    isCameraEnabled: false,
    isCameraPermissionGranted: false,
    videoStream: null,
    isFullscreen: false,
    faceDetected: false,
    faceCount: 0,
    lightingOk: true,
    warnings: [],
    totalWarnings: 0,
    isFlagged: false,
    showWarningModal: false,
    currentWarningType: null,
    tabSwitchCount: 0,
    fullscreenExitCount: 0,
    maxTabSwitches: 3,
    showWarning: false,
    warningMessage: '',
    isDisqualified: false,

    // ─── Face Detection ─────────────────────────
    setFaceDetected: (value) => set({ faceDetected: value }),
    setFaceCount: (value) => set({ faceCount: value }),
    setLightingOk: (value) => set({ lightingOk: value }),

    // ─── Camera ─────────────────────────────────
    setCameraStatus: (status) => set({ cameraStatus: status }),
    setCameraEnabled: (value) => set({ isCameraEnabled: value }),
    setCameraPermissionGranted: (value) => set({ isCameraPermissionGranted: value }),
    setCameraStream: (stream) => set({ videoStream: stream }),
    setVideoStream: (stream) => set({ videoStream: stream }),

    requestCameraPermission: async () => {
      const { videoStream, cameraStatus } = get();
      
      // If already active, return true immediately (do NOT call getUserMedia again)
      if (cameraStatus === 'active' && videoStream) {
        return true;
      }

      try {
        set({ cameraStatus: 'requesting' });

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 15, max: 30 },
          },
          audio: false,
        };

        // iOS Safari: must request in response to user gesture (handled by caller)
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        set({
          isCameraPermissionGranted: true,
          isCameraEnabled: true,
          videoStream: stream,
          cameraStatus: 'active',
        });
        return true;
      } catch (err) {
        const error = err as DOMException;
        // NotAllowedError = denied; NotReadableError = already in use (iOS bug)
        set({
          isCameraPermissionGranted: false,
          isCameraEnabled: false,
          cameraStatus: error.name === 'NotAllowedError' ? 'denied' : 'error',
        });
        console.error('[Proctoring] Camera error:', error.name, error.message);
        return false;
      }
    },

    // ─── Fullscreen ─────────────────────────────
    setFullscreen: (value) => set({ isFullscreen: value }),
    setFullscreenEnabled: (value) => set({ isFullscreen: value }),

    enterFullscreen: async () => {
      try {
        if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
          set({ isFullscreen: true });
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },

    exitFullscreen: async () => {
      try {
        if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
          set({ isFullscreen: false });
        }
      } catch {
        // Ignore errors
      }
    },

    // ─── Warnings ───────────────────────────────
    addWarning: (warning) =>
      set((state) => {
        const newTotal = state.totalWarnings + 1;
        return {
          warnings: [...state.warnings, { ...warning, count: newTotal }],
          totalWarnings: newTotal,
          isFlagged: newTotal >= 3,
          showWarningModal: true,
          currentWarningType: warning.type,
        };
      }),

    dismissWarningModal: () =>
      set({ showWarningModal: false, currentWarningType: null }),

    flagSession: () => set({ isFlagged: true }),

    // ─── Tab Switch ─────────────────────────────
    recordTabSwitch: () => {
      const { tabSwitchCount, maxTabSwitches } = get();
      const newCount = tabSwitchCount + 1;

      if (newCount >= maxTabSwitches) {
        set({
          tabSwitchCount: newCount,
          isDisqualified: true,
          showWarning: true,
          warningMessage: 'You have been disqualified for exceeding the tab switch limit.',
        });
        return true;
      }

      set({
        tabSwitchCount: newCount,
        showWarning: true,
        warningMessage: `Warning: Tab switch detected (${newCount}/${maxTabSwitches}). You will be disqualified after ${maxTabSwitches} switches.`,
      });
      return false;
    },

    recordFullscreenExit: () => {
      const { fullscreenExitCount } = get();
      set({
        fullscreenExitCount: fullscreenExitCount + 1,
        isFullscreen: false,
        showWarning: true,
        warningMessage: 'Please return to fullscreen mode to continue the quiz.',
      });
    },

    setMaxTabSwitches: (max) => set({ maxTabSwitches: max }),
    setWarning: (show, message = '') => set({ showWarning: show, warningMessage: message }),

    // ─── Reset ──────────────────────────────────
    reset: () => {
      const { videoStream } = get();
      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop());
      }

      set({
        cameraStatus: 'idle',
        isCameraEnabled: false,
        isCameraPermissionGranted: false,
        videoStream: null,
        isFullscreen: false,
        faceDetected: false,
        faceCount: 0,
        lightingOk: true,
        warnings: [],
        totalWarnings: 0,
        isFlagged: false,
        showWarningModal: false,
        currentWarningType: null,
        tabSwitchCount: 0,
        fullscreenExitCount: 0,
        showWarning: false,
        warningMessage: '',
        isDisqualified: false,
      });
    },
  })
);
