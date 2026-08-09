/**
 * Frontend mirror of the backend's start-time grid enforcement
 * (backend/src/modules/contest/contest.validator.ts — isOnStartTimeGrid,
 * config.contest.startTimeSlotMinutes / CONTEST_START_TIME_SLOT_MINUTES).
 *
 * The backend Zod `.refine()` is the actual enforcement layer — this constant only
 * drives what the TimeSlotPicker offers, so an admin can't even select an off-grid
 * value in the UI in the first place. Keep this in sync with the backend default if
 * that env var ever changes (see docs/contest-start-reliability-spec.md §6.4).
 */
export const CONTEST_START_TIME_SLOT_MINUTES = 15;

export interface TimeSlotOption {
  /** 24-hour "HH:mm", matches <input type="time"> value format */
  value: string;
  /** 12-hour display label, e.g. "12:15 PM" */
  label: string;
}

/** All valid times in a day at the given step, e.g. 96 options for a 15-minute step. */
export function getTimeSlotOptions(
  stepMinutes: number = CONTEST_START_TIME_SLOT_MINUTES,
): TimeSlotOption[] {
  const options: TimeSlotOption[] = [];
  for (let totalMinutes = 0; totalMinutes < 24 * 60; totalMinutes += stepMinutes) {
    const hours24 = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const value = `${String(hours24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const label = `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
    options.push({ value, label });
  }
  return options;
}

/** Mirrors the backend's isOnStartTimeGrid — used for the client-side validation pass. */
export function isOnStartTimeGrid(
  value: string,
  stepMinutes: number = CONTEST_START_TIME_SLOT_MINUTES,
): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const minutes = Number(match[2]);
  return minutes % stepMinutes === 0;
}
