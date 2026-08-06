'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Circle, Loader2, MinusCircle, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

export type LoadingState = {
  text: string;
};

/**
 * Per-step outcome for the "checklist" rendering mode (see `statuses` prop
 * below) — used when a loader represents a set of independent checks rather
 * than one linear progress bar. `skipped` is for steps that were
 * intentionally not run because an earlier, required step failed.
 */
export type StepStatus = 'pending' | 'loading' | 'success' | 'error' | 'skipped';

interface LoaderCoreProps {
  loadingStates: LoadingState[];
  value?: number;
  /** Index of a step that failed — rendered in destructive color with an X icon. */
  errorIndex?: number | null;
  /** Per-step status; when provided, overrides the value/errorIndex-based rendering. */
  statuses?: StepStatus[];
  /** Optional secondary line shown under a step (typically its failure/skip reason). */
  details?: (string | undefined)[];
}

const LoaderCore = ({ loadingStates, value = 0, errorIndex, statuses, details }: LoaderCoreProps) => {
  return (
    <div className="flex relative justify-start max-w-xl mx-auto flex-col mt-40">
      {loadingStates.map((loadingState, index) => {
        const distance = Math.abs(index - value);
        const opacity = Math.max(1 - distance * 0.2, 0);
        const status = statuses?.[index];
        const detail = details?.[index];

        const isError = status ? status === 'error' : errorIndex !== null && errorIndex !== undefined && index === errorIndex;
        const isSkipped = status === 'skipped';
        const isStepLoading = status === 'loading';
        const isSuccess = status ? status === 'success' : !isError && index <= value;

        return (
          <motion.div
            key={index}
            className={cn('text-left flex gap-2 mb-4')}
            initial={{ opacity: 0, y: -(value * 40) }}
            animate={{ opacity: opacity, y: -(value * 40) }}
            transition={{ duration: 0.5 }}
          >
            <div>
              {isError ? (
                <XCircle className="text-destructive h-6 w-6" />
              ) : isSkipped ? (
                <MinusCircle className="text-muted-foreground/40 h-6 w-6" />
              ) : isStepLoading ? (
                <Loader2 className="text-primary h-6 w-6 animate-spin" />
              ) : isSuccess ? (
                <CheckCircle2
                  className={cn(
                    'text-black dark:text-white h-6 w-6',
                    value === index && 'text-black dark:text-lime-500 opacity-100'
                  )}
                />
              ) : (
                <Circle className="text-black dark:text-white h-6 w-6" />
              )}
            </div>
            <div>
              <span
                className={cn(
                  'text-black dark:text-white',
                  isError && 'text-destructive dark:text-destructive font-semibold',
                  isSkipped && 'text-muted-foreground/50 line-through',
                  value === index && !isError && !isSkipped && 'text-black dark:text-lime-500 opacity-100'
                )}
              >
                {loadingState.text}
              </span>
              {detail && (isError || isSkipped) && (
                <p className="text-xs text-destructive/80 dark:text-destructive mt-0.5">{detail}</p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

interface MultiStepLoaderProps {
  loadingStates: LoadingState[];
  loading?: boolean;
  /**
   * Milliseconds between auto-advancing steps. Only used in "uncontrolled" mode
   * (i.e. when `value` is not passed) — see the `value` prop below.
   */
  duration?: number;
  /** Only relevant in uncontrolled (timer-driven) mode. */
  loop?: boolean;
  /**
   * Controlled current-step index. Pass this when the steps reflect real async
   * progress (e.g. a batch upload) instead of a fixed timer — the loader will
   * render exactly the step you tell it to, and will NOT auto-advance.
   */
  value?: number;
  /** Index of a step that failed, rendered in the destructive color. */
  errorIndex?: number | null;
  /**
   * Checklist mode: per-step status (pending/loading/success/error/skipped).
   * Use this instead of `value`/`errorIndex` when the steps are independent
   * checks rather than one linear progression — e.g. validating several
   * question pools where every check runs and is shown, not just the first
   * failure. `value` is derived automatically in this mode unless you pass
   * it explicitly.
   */
  statuses?: StepStatus[];
  /** Secondary line shown under a failed/skipped step (e.g. the reason). */
  details?: (string | undefined)[];
}

/**
 * Full-screen multi-step progress overlay.
 *
 * Three ways to use it:
 * 1. Uncontrolled/demo mode — omit `value`/`statuses`, it auto-advances every `duration` ms.
 * 2. Controlled linear mode — pass `value` (and optionally `errorIndex`) to drive the
 *    loader from real progress, e.g. a batched upload. Used by `useBatchUpload`-backed
 *    flows so the UI always reflects what's actually happened on the server.
 * 3. Checklist mode — pass `statuses` (and optionally `details`) to show independent
 *    per-step pass/fail/skip results, e.g. a set of validation checks that all run
 *    regardless of earlier failures. Used by `useStepChecklist`-backed flows.
 */
export const MultiStepLoader = ({
  loadingStates,
  loading,
  duration = 2000,
  loop = true,
  value,
  errorIndex = null,
  statuses,
  details,
}: MultiStepLoaderProps) => {
  const isControlled = value !== undefined || statuses !== undefined;
  const [internalState, setInternalState] = useState(0);

  useEffect(() => {
    if (isControlled) return;
    if (!loading) {
      setInternalState(0);
      return;
    }
    const timeout = setTimeout(() => {
      setInternalState((prevState) =>
        loop
          ? prevState === loadingStates.length - 1
            ? 0
            : prevState + 1
          : Math.min(prevState + 1, loadingStates.length - 1)
      );
    }, duration);
    return () => clearTimeout(timeout);
  }, [internalState, loading, loop, loadingStates.length, duration, isControlled]);

  let currentValue: number;
  if (value !== undefined) {
    currentValue = value;
  } else if (statuses) {
    const loadingIdx = statuses.findIndex((s) => s === 'loading');
    if (loadingIdx !== -1) {
      currentValue = loadingIdx;
    } else {
      const lastResolvedIdx = statuses.reduce(
        (acc, s, i) => (s === 'success' || s === 'error' || s === 'skipped' ? i : acc),
        0
      );
      currentValue = lastResolvedIdx;
    }
  } else {
    currentValue = internalState;
  }

  // Portal straight to document.body — same trick Radix's Dialog uses.
  // `position: fixed` only covers the real viewport when nothing between
  // this element and the root establishes a containing block (any ancestor
  // with a transform, filter, backdrop-filter, perspective, or will-change
  // does that). This component gets used inside dialogs/pages full of
  // framer-motion wrappers and `backdrop-blur` headers that do exactly
  // that, so without a portal the loader would render "behind" — really
  // just boxed inside and under — a Dialog's own body-level portal instead
  // of covering it. `mounted` guards against document not existing during
  // SSR/the first render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const content = (
    <AnimatePresence mode="wait">
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full h-full fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-2xl"
        >
          <div className="h-96 relative">
            <LoaderCore
              value={currentValue}
              loadingStates={loadingStates}
              errorIndex={errorIndex}
              statuses={statuses}
              details={details}
            />
          </div>
          <div className="bg-gradient-to-t inset-x-0 z-20 bottom-0 bg-white dark:bg-black h-full absolute [mask-image:radial-gradient(900px_at_center,transparent_30%,white)]" />
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
};
