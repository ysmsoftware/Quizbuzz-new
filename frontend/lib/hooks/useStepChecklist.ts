'use client';

import { useCallback, useState } from 'react';
import type { StepStatus } from '@/components/ui/multi-step-loader';

export interface ChecklistStepResult<T = unknown> {
  ok: boolean;
  detail?: string;
  data?: T;
}

export interface ChecklistStep<T = unknown> {
  /** Shown to the user in the multi-step loader. */
  label: string;
  run: () => Promise<ChecklistStepResult<T>>;
  /**
   * If true, this step is SKIPPED (never invoked) when any earlier step
   * failed. Use this for a final "commit" step (e.g. the actual API call)
   * that should only run once every preceding validation has passed.
   */
  requiresAllPrevious?: boolean;
}

export interface ChecklistOutcome {
  allPassed: boolean;
  results: ChecklistStepResult[];
}

/**
 * Runs a list of independent checks sequentially, pacing each one so a
 * fast/local request doesn't blip by unnoticed — but, unlike useBatchUpload,
 * this does NOT stop at the first failure. Every check runs (or is marked
 * skipped) and its outcome is shown, so the user can see every condition
 * that did or didn't hold in one pass, not just the first one that broke.
 *
 * `run()` returns `{ allPassed, results }` directly, computed locally as it
 * goes — callers should use that return value (not the hook's own state) to
 * decide what happens next, for the same reason `useBatchUpload` callers do:
 * the hook's returned object is a snapshot from the render that kicked the
 * run off, so reading `steps`/`statuses` back out of it immediately after
 * `await run(...)` resolves would see stale data.
 */
export function useStepChecklist(options: { minStepDurationMs?: number } = {}) {
  // Keeps each check visible for at least this long, purely so the user can
  // actually read what's being verified — the checks themselves already
  // finished, this only paces how fast the UI reveals the result.
  const minStepDurationMs = options.minStepDurationMs ?? 450;

  const [steps, setSteps] = useState<ChecklistStep[]>([]);
  const [statuses, setStatuses] = useState<StepStatus[]>([]);
  const [details, setDetails] = useState<(string | undefined)[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const run = useCallback(
    async (stepsList: ChecklistStep[]): Promise<ChecklistOutcome> => {
      setSteps(stepsList);
      setStatuses(new Array(stepsList.length).fill('pending'));
      setDetails(new Array(stepsList.length).fill(undefined));
      setIsRunning(true);

      const results: ChecklistStepResult[] = [];
      let anyFailed = false;

      for (let i = 0; i < stepsList.length; i++) {
        const step = stepsList[i];

        if (step.requiresAllPrevious && anyFailed) {
          const skipped: ChecklistStepResult = {
            ok: false,
            detail: 'Skipped — resolve the issues above first.',
          };
          results.push(skipped);
          setStatuses((prev) => prev.map((s, idx) => (idx === i ? 'skipped' : s)));
          setDetails((prev) => prev.map((d, idx) => (idx === i ? skipped.detail : d)));
          continue;
        }

        setStatuses((prev) => prev.map((s, idx) => (idx === i ? 'loading' : s)));
        const startedAt = Date.now();

        let result: ChecklistStepResult;
        try {
          result = await step.run();
        } catch (err: any) {
          result = { ok: false, detail: err?.message ?? `${step.label} failed` };
        }

        const elapsed = Date.now() - startedAt;
        if (elapsed < minStepDurationMs) {
          await new Promise((r) => setTimeout(r, minStepDurationMs - elapsed));
        }

        results.push(result);
        if (!result.ok) anyFailed = true;
        setStatuses((prev) => prev.map((s, idx) => (idx === i ? (result.ok ? 'success' : 'error') : s)));
        setDetails((prev) => prev.map((d, idx) => (idx === i ? result.detail : d)));
      }

      setIsRunning(false);
      return { allPassed: !anyFailed, results };
    },
    [minStepDurationMs]
  );

  const reset = useCallback(() => {
    setSteps([]);
    setStatuses([]);
    setDetails([]);
    setIsRunning(false);
  }, []);

  return { steps, statuses, details, isRunning, run, reset };
}
