'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * A single unit of work in a batch pipeline (e.g. "create batch 2 of 10",
 * "assign batch 2 of 10 to contest"). `run` receives a `getResult` accessor
 * so a later step can read what an earlier step returned (e.g. the assign
 * step for a batch needs the question IDs the create step for that same
 * batch produced) without re-doing that earlier step's work.
 */
export interface BatchStep<TResult = unknown> {
  /** Shown to the user in the multi-step loader. */
  label: string;
  run: (getResult: (stepIndex: number) => unknown) => Promise<TResult>;
}

export type BatchUploadStatus = 'idle' | 'running' | 'error' | 'success';

export interface RunOutcome {
  completed: boolean;
  failedAt?: number;
}

/**
 * Generic sequential step runner for batched uploads.
 *
 * Design goal: if step N fails (e.g. a network error mid-upload), the hook
 * stops and stays parked exactly at step N. Calling `resume()` re-runs ONLY
 * from step N onward — steps 0..N-1 already succeeded (their results are
 * kept) and are never re-sent. This is what lets a 500-question / 10-batch
 * upload survive a transient failure on batch 3 without re-uploading (and
 * duplicating) batches 1-2 that are already saved in the database.
 *
 * Reusable by any batched flow — question bulk-create, contest assignment,
 * certificate generation, etc. Just build a `BatchStep[]` and call `start`.
 *
 * IMPORTANT for callers: `start()`/`resume()` resolve inside the same async
 * closure that called them, which was created *before* any of this hook's
 * state updates land. So do NOT read `steps`/`currentIndex` off the hook's
 * return value immediately after `await start(...)` to aggregate results —
 * that object is a snapshot from before the run began. Instead pass the
 * `BatchStep[]` you built straight into your own aggregation code, and use
 * `getResult(i)` (which is ref-backed and always current) to read each
 * step's output. See useBatchUpload's own steps/currentIndex for rendering
 * (those ARE safe to read in JSX — every render gets the latest value).
 */
export function useBatchUpload(options: { minStepDurationMs?: number } = {}) {
  // Keeps each step visible for at least this long before advancing, purely
  // so fast/local requests don't blip by faster than a human can register
  // that batching is happening. The real work already finished — this only
  // paces the UI, it never blocks or retries anything.
  const minStepDurationMs = options.minStepDurationMs ?? 400;

  const [steps, setSteps] = useState<BatchStep[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<BatchUploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Kept in a ref (not state) so `getResult` always sees the latest value
  // even mid-loop, without waiting for a re-render.
  const resultsRef = useRef<unknown[]>([]);

  const getResult = useCallback((index: number) => resultsRef.current[index], []);

  const runFrom = useCallback(
    async (startIndex: number, stepsList: BatchStep[]): Promise<RunOutcome> => {
      setStatus('running');
      setError(null);

      for (let i = startIndex; i < stepsList.length; i++) {
        setCurrentIndex(i);
        const stepStartedAt = Date.now();
        try {
          const result = await stepsList[i].run(getResult);
          resultsRef.current[i] = result;
        } catch (err: any) {
          setStatus('error');
          setError(err?.message ?? `${stepsList[i].label} failed`);
          setCurrentIndex(i); // stay parked here so resume() retries this exact step
          return { completed: false, failedAt: i };
        }
        const elapsed = Date.now() - stepStartedAt;
        if (elapsed < minStepDurationMs) {
          await new Promise((r) => setTimeout(r, minStepDurationMs - elapsed));
        }
      }

      setStatus('success');
      setCurrentIndex(stepsList.length); // past the last step -> all rendered as done
      return { completed: true };
    },
    [getResult, minStepDurationMs]
  );

  /** Begins a brand-new run, discarding any previous progress. */
  const start = useCallback(
    (stepsList: BatchStep[]) => {
      resultsRef.current = new Array(stepsList.length).fill(undefined);
      setSteps(stepsList);
      setCurrentIndex(0);
      return runFrom(0, stepsList);
    },
    [runFrom]
  );

  /** Retries from the step that failed, keeping every earlier result. */
  const resume = useCallback(() => runFrom(currentIndex, steps), [runFrom, currentIndex, steps]);

  const reset = useCallback(() => {
    resultsRef.current = [];
    setSteps([]);
    setCurrentIndex(0);
    setStatus('idle');
    setError(null);
  }, []);

  return {
    steps,
    currentIndex,
    status,
    error,
    getResult,
    start,
    resume,
    reset,
    isLoading: status === 'running',
  };
}
