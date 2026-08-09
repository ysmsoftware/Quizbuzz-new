import { RescheduleContestSchema } from "./contest.validator";

/**
 * Covers the 15-minute start-time grid refine (contest-start-reliability spec §6.4) —
 * the one piece of new branch logic in this change that isn't already exercised by
 * existing reschedule/create tests.
 */
describe("RescheduleContestSchema — start-time grid", () => {
  const base = {
    registrationDeadline: undefined,
    duration: 60,
    notifyParticipants: true,
  };

  it("accepts a start time on the 15-minute grid", () => {
    const result = RescheduleContestSchema.safeParse({
      ...base,
      startTime: "2030-01-01T10:15:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a start time off the 15-minute grid", () => {
    const result = RescheduleContestSchema.safeParse({
      ...base,
      startTime: "2030-01-01T10:07:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a start time with nonzero seconds even on a valid minute mark", () => {
    const result = RescheduleContestSchema.safeParse({
      ...base,
      startTime: "2030-01-01T10:15:30.000Z",
    });
    expect(result.success).toBe(false);
  });
});
