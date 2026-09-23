import Redis from "ioredis";
import { config } from "../config";
import { EmailRateLimiter } from "./email-rate-limiter";

// Runs against a real Redis (the Lua script is the logic under test) under a throwaway prefix.
// Skips itself when no Redis is reachable so `npm test` never hangs on a machine without one;
// locally: REDIS_PORT=7015 REDIS_PASSWORD=… npx jest src/providers/email-rate-limiter.test.ts
const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    ...(config.redis.password && { password: config.redis.password }),
    lazyConnect: true,
    connectTimeout: 1000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
});
let redisUp = false;
beforeAll(async () => {
    redisUp = await redis.connect().then(() => true, () => false);
    if (!redisUp) console.warn("[email-rate-limiter.test] Redis not reachable — skipping");
});
const HOUR = 60 * 60 * 1000;
const MARGIN = 1000;
const T0 = 1_700_000_000_000;

describe("EmailRateLimiter (mailbox limit 3, auth reserve 1)", () => {
    let now = T0;
    const prefix = `test:email-rate:${Date.now()}-${Math.random()}`;
    const limiter = new EmailRateLimiter(redis, { prefix, windowMs: HOUR, marginMs: MARGIN, clock: () => now });
    const mailboxes = [{ id: "support@x.com", hourlyLimit: 3, criticalReserve: 1 }];

    afterAll(async () => {
        if (redisUp) {
            const keys = await redis.keys(`${prefix}:*`);
            if (keys.length) await redis.del(...keys);
        }
        redis.disconnect();
    });

    it("books first-in-first-out slots, keeps the auth reserve, and releases after the window", async () => {
        if (!redisUp) return;
        // Standard lane = 3 - 1 = 2 per hour
        const a = await limiter.book(mailboxes, false, true);
        now += 10;
        const b = await limiter.book(mailboxes, false, true);
        expect(a).toEqual({ slot: { mailboxId: "support@x.com", at: T0 }, immediate: true });
        expect(b?.immediate).toBe(true);

        // 3rd standard: scheduled for exactly when the 1st leaves the window (+ margin)
        now += 10;
        const c = await limiter.book(mailboxes, false, true);
        expect(c).toEqual({ slot: { mailboxId: "support@x.com", at: T0 + HOUR + MARGIN }, immediate: false });

        // 4th standard: after the 3rd (FIFO), based on the 2nd leaving the window
        now += 10;
        const d = await limiter.book(mailboxes, false, true);
        expect(d!.immediate).toBe(false);
        expect(d!.slot.at).toBeGreaterThanOrEqual(c!.slot.at);
        expect(d!.slot.at).toBe(T0 + 10 + HOUR + MARGIN);

        // Direct (non-schedulable) standard send books nothing when full
        expect(await limiter.book(mailboxes, false, false)).toBeNull();

        // Auth email still goes out now, from the reserve, despite the standard backlog
        const otp = await limiter.book(mailboxes, true, false);
        expect(otp?.immediate).toBe(true);

        // A 2nd auth email this hour: reserve used → joins the standard FIFO behind the backlog
        const otp2 = await limiter.book(mailboxes, true, true);
        expect(otp2!.immediate).toBe(false);
        expect(otp2!.slot.at).toBeGreaterThanOrEqual(d!.slot.at);

        // Past the window, a newcomer still can't overtake the waiting ones (FIFO)…
        now = T0 + HOUR + MARGIN + 5;
        const e = await limiter.book(mailboxes, false, true);
        expect(e!.slot.at).toBeGreaterThanOrEqual(otp2!.slot.at);

        // …but once the whole backlog has drained, sends are immediate again
        now = e!.slot.at + 2 * HOUR;
        expect((await limiter.book(mailboxes, false, true))?.immediate).toBe(true);
    });
});
