'use client';

type ViolationType = 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'WINDOW_BLUR' | 'SCREEN_RESIZE';

interface ProctoringConfig {
  onViolation: (type: ViolationType, severity: number, metadata?: any) => void;
  enabled: boolean;
  fullscreenRequired?: boolean;
}

/**
 * Service to detect and report proctoring violations in the browser
 */
export function startProctoring({ onViolation, enabled, fullscreenRequired }: ProctoringConfig) {
  if (!enabled || typeof window === 'undefined') return () => {};

  const handleVisibilityChange = () => {
    if (document.hidden) {
      onViolation('TAB_SWITCH', 2, { url: window.location.href });
    }
  };

  const handleBlur = () => {
    onViolation('WINDOW_BLUR', 1);
  };

  const handleFullscreenChange = () => {
    if (fullscreenRequired && !document.fullscreenElement) {
      onViolation('FULLSCREEN_EXIT', 2);
    }
  };

  const handleResize = () => {
    // Detect drastic resize that might indicate window splitting
    if (window.innerWidth < 800 || window.innerHeight < 600) {
      onViolation('SCREEN_RESIZE', 1, { 
        width: window.innerWidth, 
        height: window.innerHeight 
      });
    }
  };

  // Attach listeners
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('blur', handleBlur);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  window.addEventListener('resize', handleResize);

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('blur', handleBlur);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    window.removeEventListener('resize', handleResize);
  };
}

/**
 * Request fullscreen mode for the quiz
 */
export async function enterFullscreen() {
  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
      return true;
    }
  } catch (err) {
    console.error('Failed to enter fullscreen:', err);
  }
  return false;
}
