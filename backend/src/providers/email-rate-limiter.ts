import type Redis from "ioredis";
import crypto from "crypto";
import logger from "../config/logger";

/**
 * Per-mailbox rolling-hour send cap, as *slot booking* rather than try-and-bounce.
 *
 * Each mailbox lane is a Redis sorted set of booked send times (ms) — past = already sent,
 * future = booked by a message that's waiting. A booking is always placed at/after the latest
 * existing booking, so booking order == send order: strict FIFO, a new message can never
 * overtake one that is already waiting. For a lane limit L and bookings s1..sm (sorted), the
 * earliest valid time is
 *     t = max(now, s_m, s_(m-L+1) + window + margin)      (last term only when m >= L)
 * which leaves at most L-1 other bookings in (t - window, t] — the cap can't be exceeded.
 *
 * Two lanes per mailbox keep an auth-email reserve without breaking FIFO: "standard"
 * (hourlyLimit - reserve) and "critical" (reserve). Their sum is the mailbox limit, so every
 * rolling hour stays under it. Critical emails take an immediate critical-lane slot when one
 * is free, otherwise they queue in the standard lane like everything else.
 *
 * Computing + committing a booking is one atomic Lua script, so the API process and the
 * worker process can't race each other. `now` comes from Redis TIME (one clock for every
 * host) unless a test pins it.
 */
const BOOK_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
if not now then
  local tm = redis.call('TIME')
  now = tonumber(tm[1]) * 1000 + math.floor(tonumber(tm[2]) / 1000)
end
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local margin = tonumber(ARGV[4])
local member = ARGV[5]
local mode = ARGV[6] -- 'now' = book only if sendable now; 'future' = book earliest slot; 'peek' = never book

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
if limit <= 0 then return {-1, 0, now} end

local m = redis.call('ZCARD', key)
local t = now
if m > 0 then
  local last = tonumber(redis.call('ZRANGE', key, -1, -1, 'WITHSCORES')[2])
  if last > t then t = last end
end
if m >= limit then
  local s = tonumber(redis.call('ZRANGE', key, m - limit, m - limit, 'WITHSCORES')[2])
  local candidate = s + window + margin
  if candidate > t then t = candidate end
end

if mode == 'future' or (mode == 'now' and t <= now) then
  redis.call('ZADD', key, t, member)
  redis.call('PEXPIRE', key, math.ceil(t - now + window + margin))
  return {t, 1, now}
end
return {t, 0, now}
`;

export interface MailboxLimits {
    id: string;
    hourlyLimit: number;
    criticalReserve: number;
}

/** A booked send slot on one mailbox. Persisted in the message job data while it waits for `at`. */
export interface SlotBooking {
    mailboxId: string;
    at: number;
}

type Mode = "now" | "future" | "peek";

export class EmailRateLimiter {
    constructor(
        private readonly redis: Redis,
        private readonly opts: { prefix: string; windowMs: number; marginMs: number; clock?: () => number },
    ) { }

    private async _run(mailboxId: string, lane: "standard" | "critical", limit: number, mode: Mode) {
        const [t, committed, now] = (await this.redis.eval(
            BOOK_SCRIPT,
            1,
            `${this.opts.prefix}:${mailboxId}:${lane}`,
            this.opts.clock ? String(this.opts.clock()) : "",
            String(this.opts.windowMs),
            String(limit),
            String(this.opts.marginMs),
            crypto.randomUUID(),
            mode,
        )) as [number, number, number];
        return { at: t, committed: committed === 1, now, usable: t >= 0 };
    }

    /**
     * Books a send slot on the best mailbox. `immediate` = send now; otherwise `slot.at` is a
     * booked future time (only when `allowFuture`). Returns null when
     * nothing is free now and a future booking isn't allowed (nothing is booked then).
     * Mailbox order is rotation order: the first one with an immediate slot wins; otherwise
     * the mailbox with the earliest future slot is booked.
     */
    async book(mailboxes: MailboxLimits[], critical: boolean, allowFuture: boolean): Promise<{ slot: SlotBooking; immediate: boolean } | null> {
        try {
            for (const mb of mailboxes) {
                if (critical) {
                    const c = await this._run(mb.id, "critical", Math.min(mb.criticalReserve, mb.hourlyLimit), "now");
                    if (c.committed) return { slot: { mailboxId: mb.id, at: c.at }, immediate: true };
                }
                const s = await this._run(mb.id, "standard", mb.hourlyLimit - mb.criticalReserve, "now");
                if (s.committed) return { slot: { mailboxId: mb.id, at: s.at }, immediate: true };
            }
            if (!allowFuture) return null;

            // Nothing free now — book the earliest future standard-lane slot across mailboxes.
            // The Lua recomputes atomically at booking time, so a race between peek and book
            // only shifts the slot a little later, never over the cap.
            let best: { mb: MailboxLimits; at: number } | null = null;
            for (const mb of mailboxes) {
                const p = await this._run(mb.id, "standard", mb.hourlyLimit - mb.criticalReserve, "peek");
                if (p.usable && (!best || p.at < best.at)) best = { mb, at: p.at };
            }
            if (!best) return null;
            const b = await this._run(best.mb.id, "standard", best.mb.hourlyLimit - best.mb.criticalReserve, "future");
            return { slot: { mailboxId: best.mb.id, at: b.at }, immediate: b.at <= b.now };
        } catch (err) {
            // ponytail: fails OPEN when Redis is unreachable (the queue can't run without Redis
            // anyway, so this only affects direct OTP sends) — switch to fail-closed if going
            // over the provider cap turns out worse than blocking logins.
            logger.warn(`[email-rate-limiter] Redis unavailable, sending without cap check: ${(err as Error).message}`);
            return mailboxes[0] ? { slot: { mailboxId: mailboxes[0].id, at: Date.now() }, immediate: true } : null;
        }
    }
}
