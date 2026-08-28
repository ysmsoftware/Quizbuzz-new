import { RescheduleContestSchema } from "./contest.validator";
import { config } from "../../config";

/**
 * Covers the start-time grid refine (contest-start-reliability spec §6.4) — the one
 * piece of new branch logic in this change that isn't already exercised by existing
 * reschedule/create tests. The grid size is read from
 * config.contest.startTimeSlotMinutes (currently a 10-minute grid) rather than
 * hardcoded here, so this test doesn't silently go stale the next time the grid
 * size changes — it broke exactly this way when the grid moved from 15 to 10.
 */
describe("RescheduleContestSchema — start-time grid", () => {
  const base = {
    registrationDeadline: undefined,
    duration: 60,
    notifyParticipants: true,
  };
  const step = config.contest.startTimeSlotMinutes;
  const onGridMinute = String(step).padStart(2, "0");
  const offGridMinute = String(step - 1).padStart(2, "0");

  it(`accepts a start time on the ${step}-minute grid`, () => {
    const result = RescheduleContestSchema.safeParse({
      ...base,
      startTime: `2030-01-01T10:${onGridMinute}:00.000Z`,
    });
    expect(result.success).toBe(true);
  });

  it(`rejects a start time off the ${step}-minute grid`, () => {
    const result = RescheduleContestSchema.safeParse({
      ...base,
      startTime: `2030-01-01T10:${offGridMinute}:00.000Z`,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a start time with nonzero seconds even on a valid minute mark", () => {
    const result = RescheduleContestSchema.safeParse({
      ...base,
      startTime: `2030-01-01T10:${onGridMinute}:30.000Z`,
    });
    expect(result.success).toBe(false);
  });
});
