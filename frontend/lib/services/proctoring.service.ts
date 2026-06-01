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

  // iOS Safari and Chrome on iOS do not support the Fullscreen API.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  const handleVisibilityChange = () => {
    if (document.hidden) {
      onViolation('TAB_SWITCH', 2, { url: window.location.href });
    }
  };

  const handleBlur = () => {
    onViolation('WINDOW_BLUR', 1);
  };

  const handleFullscreenChange = () => {
    // On iOS the fullscreenElement API does not exist, so skip this check entirely.
    if (fullscreenRequired && !isIOS && !(document as any).fullscreenElement && !(document as any).webkitFullscreenElement) {
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
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange); // Safari
  window.addEventListener('resize', handleResize);

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('blur', handleBlur);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    window.removeEventListener('resize', handleResize);
  };
}

/**
 * Request fullscreen mode for the quiz
 */
export async function enterFullscreen() {
  try {
    const isIOS = typeof navigator !== 'undefined' &&
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as any).MSStream;

    // iOS does not support the Fullscreen API — return true so callers proceed.
    if (isIOS) return true;

    const el = document.documentElement as any;
    if (el.requestFullscreen) {
      await el.requestFullscreen();
      return true;
    } else if (el.webkitRequestFullscreen) {
      // Older Safari desktop
      await el.webkitRequestFullscreen();
      return true;
    }
  } catch (err) {
    console.error('Failed to enter fullscreen:', err);
  }
  return false;
}
