/**
 * Quiz Session Helper — Redis Key Patterns & Operations
 *
 * Key naming (per engineering guidelines):
 *   quiz:{cid}:session:{pid}      ← participant session hash (phase, progress, violations)
 *   quiz:{cid}:answers:{pid}      ← in-progress answers hash
 *   quiz:{cid}:heartbeat:{pid}    ← alive signal (TTL-based)
 *   quiz:{cid}:questions:{pid}    ← shuffled question order
 *   quiz:{cid}:meta:{pid}         ← immutable participant metadata (name, contactId) — written once at join
 *   quiz:{cid}:ready:{pid}        ← readiness flags (camera, otp, joincode)
 *   quiz:{cid}:violations:{pid}   ← violation event log (list)
 *
 *   quiz:{cid}:waiting            ← Redis Set  — participants in waiting room
 *   quiz:{cid}:active             ← Redis Set  — participants currently in quiz
 *   quiz:{cid}:submitted          ← Redis Set  — participants who submitted
 *   quiz:{cid}:disconnected       ← Redis Set  — participants whose heartbeat expired
 */

import { redis } from "../../config/redis";
import { config } from "../../config";
import {
  QuizSessionState,
  QuizPhase,
  ReadinessState,
  ViolationEvent,
  SavedAnswer,
} from "./quiz.types";

const SESSION_TTL   = config.redis.ttl.quizSession;
const HEARTBEAT_TTL = config.redis.ttl.heartbeat;

// ─── Parsed session returned from Redis ──────────────────────────────────────

export interface ParsedSession {
  phase:            QuizPhase;
  organizationId:   string;
  contactId:        string;
  socketId:         string;
  seed:             string;
  startedAt:        string;
  currentQuestion:  number;
  totalQuestions:   number;
  contestEndTime:   string;
  violationCount:   number;
  lastHeartbeatAt:  string;
}

// ─── Per-participant metadata (written once, read for live snapshot) ──────────

export interface ParticipantMeta {
  name:       string;   // firstName + lastName
  contactId:  string;
}

// ─── Live snapshot shape returned by getLiveSnapshot ─────────────────────────

export interface RedisCounts {
  waiting:      number;
  active:       number;
  submitted:    number;
  disconnected: number;
}

export interface LiveParticipantRow {
  participantId:       string;
  name:                string;
  phase:               QuizPhase;
  currentQuestionIndex: number;
  totalQuestions:      number;
  answeredCount:       number;
  violationCount:      number;
  trustScore:          number;
  isFlagged:           boolean;
  lastActivityAt:      string;
  isAlive:             boolean;
}

// ─── QuizSession ─────────────────────────────────────────────────────────────

export class QuizSession {

  // ── Key builders ────────────────────────────────────────────────────────────

  private keys(cid: string, pid: string) {
    return {
      session:    `quiz:${cid}:session:${pid}`,
      answers:    `quiz:${cid}:answers:${pid}`,
      heartbeat:  `quiz:${cid}:heartbeat:${pid}`,
      questions:  `quiz:${cid}:questions:${pid}`,
      meta:       `quiz:${cid}:meta:${pid}`,
      ready:      `quiz:${cid}:ready:${pid}`,
      violations: `quiz:${cid}:violations:${pid}`,
    };
  }

  private setKeys(cid: string) {
    return {
      waiting:      `quiz:${cid}:waiting`,
      active:       `quiz:${cid}:active`,
      submitted:    `quiz:${cid}:submitted`,
      disconnected: `quiz:${cid}:disconnected`,
    };
  }

  // ── Participant metadata (written once at join) ──────────────────────────────
  // Stores name + contactId so the live snapshot never needs a DB call for labels.

  async setParticipantMeta(cid: string, pid: string, meta: ParticipantMeta): Promise<void> {
    const key = this.keys(cid, pid).meta;
    await redis.hset(key, { name: meta.name, contactId: meta.contactId });
    await redis.expire(key, SESSION_TTL);
  }

  async getParticipantMeta(cid: string, pid: string): Promise<ParticipantMeta | null> {
    const raw = await redis.hgetall(this.keys(cid, pid).meta);
    if (!raw?.name) return null;
    return { name: raw.name, contactId: raw.contactId ?? "" };
  }

  // ── Session management ───────────────────────────────────────────────────────

  async createSession(state: QuizSessionState): Promise<void> {
    const k = this.keys(state.contestId, state.participantId);
    const flat: Record<string, string> = {
      organizationId:  state.organizationId,
      contactId:       state.contactId,
      socketId:        state.socketId,
      phase:           state.phase,
      seed:            state.seed,
      startedAt:       state.startedAt,
      currentQuestion: String(state.currentQuestion),
      totalQuestions:  String(state.totalQuestions),
      contestEndTime:  state.contestEndTime,
      violationCount:  String(state.violationCount),
      lastHeartbeatAt: state.lastHeartbeatAt,
    };
    const p = redis.pipeline();
    p.hset(k.session, flat);
    p.expire(k.session, SESSION_TTL);
    await p.exec();
  }

  async getSession(contestId: string, participantId: string): Promise<QuizSessionState | null> {
    const data = await redis.hgetall(this.keys(contestId, participantId).session);
    if (!data?.contactId) return null;
    return {
      contestId,
      participantId,
      organizationId:  data.organizationId  ?? "",
      contactId:       data.contactId        ?? "",
      socketId:        data.socketId         ?? "",
      phase:           (data.phase as QuizPhase) ?? "WAITING",
      seed:            data.seed             ?? "",
      startedAt:       data.startedAt        ?? "",
      currentQuestion: parseInt(data.currentQuestion ?? "0", 10),
      totalQuestions:  parseInt(data.totalQuestions  ?? "0", 10),
      contestEndTime:  data.contestEndTime   ?? "",
      violationCount:  parseInt(data.violationCount  ?? "0", 10),
      lastHeartbeatAt: data.lastHeartbeatAt  ?? "",
    };
  }

  async updatePhase(contestId: string, participantId: string, phase: QuizPhase): Promise<void> {
    await redis.hset(this.keys(contestId, participantId).session, "phase", phase);
  }

  // ── Questions (shuffled order) ───────────────────────────────────────────────

  async saveQuestionOrder(cid: string, pid: string, questionIds: string[]): Promise<void> {
    const key = this.keys(cid, pid).questions;
    await redis.set(key, JSON.stringify(questionIds), "EX", SESSION_TTL);
  }

  async getQuestionOrder(cid: string, pid: string): Promise<string[] | null> {
    const raw = await redis.get(this.keys(cid, pid).questions);
    return raw ? JSON.parse(raw) : null;
  }

  // ── Answers ──────────────────────────────────────────────────────────────────

  async saveAnswer(cid: string, pid: string, questionId: string, answer: SavedAnswer): Promise<void> {
    const k = this.keys(cid, pid);

    // Atomic Lua: save answer + conditionally bump currentQuestion on first save
    const lua = `
      local answersKey = KEYS[1]
      local sessionKey = KEYS[2]
      local questionId = ARGV[1]
      local answerData = ARGV[2]
      local ttl        = tonumber(ARGV[3])
      local isNew = redis.call('HEXISTS', answersKey, questionId)
      redis.call('HSET', answersKey, questionId, answerData)
      redis.call('EXPIRE', answersKey, ttl)
      if isNew == 0 then
        redis.call('HINCRBY', sessionKey, 'currentQuestion', 1)
      end
      return 1
    `;
    await redis.eval(lua, 2, k.answers, k.session, questionId, JSON.stringify(answer), SESSION_TTL);
  }

  async getAllAnswers(cid: string, pid: string): Promise<Record<string, SavedAnswer>> {
    const raw = await redis.hgetall(this.keys(cid, pid).answers);
    const result: Record<string, SavedAnswer> = {};
    for (const [qid, json] of Object.entries(raw ?? {})) {
      result[qid] = JSON.parse(json);
    }
    return result;
  }

  // ── Heartbeat ────────────────────────────────────────────────────────────────

  async refreshHeartbeat(cid: string, pid: string): Promise<void> {
    const k = this.keys(cid, pid);
    const p = redis.pipeline();
    p.set(k.heartbeat, "1", "EX", HEARTBEAT_TTL);
    p.hset(k.session, "lastHeartbeatAt", new Date().toISOString());
    await p.exec();
  }

  async isAlive(cid: string, pid: string): Promise<boolean> {
    return (await redis.exists(this.keys(cid, pid).heartbeat)) === 1;
  }

  // ── Participant state sets ────────────────────────────────────────────────────
  // These are the single source of truth for live counts — no DB involved.

  async addToWaitingRoom(cid: string, pid: string): Promise<void> {
    const s = this.setKeys(cid);
    const p = redis.pipeline();
    p.sadd(s.waiting, pid);
    p.srem(s.disconnected, pid); // clear disconnected if rejoining
    await p.exec();
  }

  async removeFromWaitingRoom(cid: string, pid: string): Promise<void> {
    await redis.srem(this.setKeys(cid).waiting, pid);
  }

  async addToActive(cid: string, pid: string): Promise<void> {
    const s = this.setKeys(cid);
    const p = redis.pipeline();
    p.sadd(s.active, pid);
    p.srem(s.waiting, pid);       // ensure not double-counted
    p.srem(s.disconnected, pid);
    await p.exec();
  }

  async removeFromActive(cid: string, pid: string): Promise<void> {
    await redis.srem(this.setKeys(cid).active, pid);
  }

  async addToSubmitted(cid: string, pid: string): Promise<void> {
    const s = this.setKeys(cid);
    const p = redis.pipeline();
    p.sadd(s.submitted, pid);
    p.srem(s.active, pid);
    p.srem(s.waiting, pid);
    p.srem(s.disconnected, pid);
    await p.exec();
  }

  async markDisconnected(cid: string, pid: string): Promise<void> {
    const s = this.setKeys(cid);
    // Only move to disconnected if they haven't submitted
    const isSubmitted = await redis.sismember(s.submitted, pid);
    if (!isSubmitted) {
      const p = redis.pipeline();
      p.sadd(s.disconnected, pid);
      p.srem(s.active, pid);
      p.srem(s.waiting, pid);
      await p.exec();
    }
  }

  async markReconnected(cid: string, pid: string, currentPhase: QuizPhase): Promise<void> {
    const s = this.setKeys(cid);
    const p = redis.pipeline();
    p.srem(s.disconnected, pid);
    if (currentPhase === "WAITING") {
      p.sadd(s.waiting, pid);
    } else if (currentPhase === "IN_QUIZ") {
      p.sadd(s.active, pid);
    }
    await p.exec();
  }

  // ── Set counts (used for quick stats) ────────────────────────────────────────

  async getWaitingCount(cid: string):  Promise<number> { return redis.scard(this.setKeys(cid).waiting); }
  async getActiveCount(cid: string):   Promise<number> { return redis.scard(this.setKeys(cid).active); }
  async getSubmittedCount(cid: string): Promise<number> { return redis.scard(this.setKeys(cid).submitted); }

  async getSetMembers(cid: string, set: "waiting" | "active" | "submitted" | "disconnected"): Promise<string[]> {
    return redis.smembers(this.setKeys(cid)[set]);
  }

  /** @deprecated kept for backward-compat with quiz-timer worker */
  async getActiveMembers(cid: string, type: "waiting" | "active" = "active"): Promise<string[]> {
    return this.getSetMembers(cid, type);
  }

  // ── Live snapshot — pure Redis, zero DB, O(N) pipelining ─────────────────────
  //
  // Strategy:
  //   Round-trip 1 : SCARD×4 + SMEMBERS×3  (all in one pipeline)
  //   Round-trip 2 : HGETALL session + HLEN answers per participant (one pipeline)
  //   Zero sequential per-participant calls.

  async getLiveSnapshot(
    cid: string,
    violationThreshold: number
  ): Promise<{
    counts:       RedisCounts;
    participants: LiveParticipantRow[];
  }> {
    const s = this.setKeys(cid);

    // ── Round-trip 1: counts + all participant IDs ────────────────────────────
    const rt1 = redis.pipeline();
    rt1.scard(s.waiting);        // 0
    rt1.scard(s.active);         // 1
    rt1.scard(s.submitted);      // 2
    rt1.scard(s.disconnected);   // 3
    rt1.smembers(s.waiting);     // 4
    rt1.smembers(s.active);      // 5
    rt1.smembers(s.submitted);   // 6
    const rt1Results = await rt1.exec();

    const counts: RedisCounts = {
      waiting:      (rt1Results?.[0]?.[1] as number) ?? 0,
      active:       (rt1Results?.[1]?.[1] as number) ?? 0,
      submitted:    (rt1Results?.[2]?.[1] as number) ?? 0,
      disconnected: (rt1Results?.[3]?.[1] as number) ?? 0,
    };

    // Merge all participant IDs across all live sets (deduplicated)
    const waitingIds    = (rt1Results?.[4]?.[1] as string[]) ?? [];
    const activeIds     = (rt1Results?.[5]?.[1] as string[]) ?? [];
    const submittedIds  = (rt1Results?.[6]?.[1] as string[]) ?? [];

    const allPids = [...new Set([...waitingIds, ...activeIds, ...submittedIds])];

    if (allPids.length === 0) {
      return { counts, participants: [] };
    }

    // Build a lookup for which set each pid belongs to
    const phaseMap = new Map<string, QuizPhase>();
    for (const pid of waitingIds)   phaseMap.set(pid, "WAITING");
    for (const pid of activeIds)    phaseMap.set(pid, "IN_QUIZ");
    for (const pid of submittedIds) phaseMap.set(pid, "SUBMITTED");

    // ── Round-trip 2: batch fetch session + meta + answers length + heartbeat ─
    const rt2 = redis.pipeline();
    for (const pid of allPids) {
      const k = this.keys(cid, pid);
      rt2.hgetall(k.session);    // session hash  (3N+0)
      rt2.hgetall(k.meta);       // meta hash     (3N+1)
      rt2.hlen(k.answers);       // answer count  (3N+2)
      rt2.exists(k.heartbeat);   // alive?        (3N+3)
    }
    const rt2Results = await rt2.exec();

    const participants: LiveParticipantRow[] = allPids.map((pid, i) => {
      const base = i * 4;
      const sessionRaw  = (rt2Results?.[base]?.[1]   as Record<string, string> | null) ?? {};
      const metaRaw     = (rt2Results?.[base + 1]?.[1] as Record<string, string> | null) ?? {};
      const answeredCount = (rt2Results?.[base + 2]?.[1] as number) ?? 0;
      const alive         = ((rt2Results?.[base + 3]?.[1] as number) ?? 0) === 1;

      const violationCount  = parseInt(sessionRaw.violationCount ?? "0", 10);
      const totalQuestions  = parseInt(sessionRaw.totalQuestions ?? "0", 10);
      const currentQuestion = parseInt(sessionRaw.currentQuestion ?? "0", 10);
      const phase           = (sessionRaw.phase as QuizPhase) ?? phaseMap.get(pid) ?? "WAITING";
      const name            = metaRaw.name ?? "Participant";
      const lastActivityAt  = sessionRaw.lastHeartbeatAt ?? new Date().toISOString();

      return {
        participantId:        pid,
        name,
        phase,
        currentQuestionIndex: currentQuestion,
        totalQuestions,
        answeredCount,
        violationCount,
        trustScore:    Math.max(0, 100 - violationCount * 10),
        isFlagged:     violationCount >= violationThreshold,
        lastActivityAt,
        isAlive:       alive,
      };
    });

    return { counts, participants };
  }

  // ── Readiness ────────────────────────────────────────────────────────────────

  async setReadiness(cid: string, pid: string, field: keyof ReadinessState, value: boolean): Promise<void> {
    const k = this.keys(cid, pid);
    await redis.hset(k.ready, field, value ? "1" : "0");
    await redis.expire(k.ready, SESSION_TTL);
  }

  async getReadiness(cid: string, pid: string): Promise<ReadinessState> {
    const data = await redis.hgetall(this.keys(cid, pid).ready);
    return {
      camera:   data?.camera   === "1",
      otp:      data?.otp      === "1",
      joincode: data?.joincode === "1",
    };
  }

  // ── Violations ───────────────────────────────────────────────────────────────

  async recordViolation(cid: string, pid: string, violation: ViolationEvent): Promise<number> {
    const k = this.keys(cid, pid);
    const p = redis.pipeline();
    p.rpush(k.violations, JSON.stringify(violation));
    p.hincrby(k.session, "violationCount", 1);
    const results = await p.exec();
    return (results?.[0]?.[1] as number) ?? 0;
  }

  async getViolations(cid: string, pid: string): Promise<ViolationEvent[]> {
    const raw = await redis.lrange(this.keys(cid, pid).violations, 0, -1);
    return raw.map(v => JSON.parse(v));
  }

  async getViolationCount(cid: string, pid: string): Promise<number> {
    return redis.llen(this.keys(cid, pid).violations);
  }

  // ── Single-participant full snapshot (one pipeline call) ───────────────────
  //
  // Returns every piece of data about a participant in 3 Redis commands batched
  // into one round-trip. Used by the admin detail view and by the submission
  // worker to read all answers without multiple calls.
  //
  // Returns: session state, name, all answers, violation list, alive flag

  async getParticipantSnapshot(cid: string, pid: string): Promise<{
    session:     QuizSessionState | null;
    name:        string;
    answers:     Record<string, SavedAnswer>;
    violations:  ViolationEvent[];
    isAlive:     boolean;
    answeredCount: number;
  }> {
    const k = this.keys(cid, pid);
    const p = redis.pipeline();
    p.hgetall(k.session);    // 0
    p.hgetall(k.meta);       // 1
    p.hgetall(k.answers);    // 2
    p.lrange(k.violations, 0, -1); // 3
    p.exists(k.heartbeat);   // 4
    const results = await p.exec();

    const sessionRaw    = (results?.[0]?.[1] as Record<string, string> | null) ?? {};
    const metaRaw       = (results?.[1]?.[1] as Record<string, string> | null) ?? {};
    const answersRaw    = (results?.[2]?.[1] as Record<string, string> | null) ?? {};
    const violationsRaw = (results?.[3]?.[1] as string[]) ?? [];
    const alive         = ((results?.[4]?.[1] as number) ?? 0) === 1;

    const session: QuizSessionState | null = sessionRaw?.contactId
      ? {
          contestId:       cid,
          participantId:   pid,
          organizationId:  sessionRaw.organizationId  ?? "",
          contactId:       sessionRaw.contactId        ?? "",
          socketId:        sessionRaw.socketId         ?? "",
          phase:           (sessionRaw.phase as QuizPhase) ?? "WAITING",
          seed:            sessionRaw.seed             ?? "",
          startedAt:       sessionRaw.startedAt        ?? "",
          currentQuestion: parseInt(sessionRaw.currentQuestion ?? "0", 10),
          totalQuestions:  parseInt(sessionRaw.totalQuestions  ?? "0", 10),
          contestEndTime:  sessionRaw.contestEndTime   ?? "",
          violationCount:  parseInt(sessionRaw.violationCount  ?? "0", 10),
          lastHeartbeatAt: sessionRaw.lastHeartbeatAt  ?? "",
        }
      : null;

    const answers: Record<string, SavedAnswer> = {};
    for (const [qid, json] of Object.entries(answersRaw)) {
      try { answers[qid] = JSON.parse(json); } catch { /* skip corrupt */ }
    }

    const violations: ViolationEvent[] = violationsRaw
      .map(v => { try { return JSON.parse(v); } catch { return null; } })
      .filter(Boolean);

    return {
      session,
      name:          metaRaw.name      ?? "Participant",
      answers,
      violations,
      isAlive:       alive,
      answeredCount: Object.keys(answers).length,
    };
  }

  // ── Flush helper — used by analytics worker to sync state to DB ──────────────
  // Returns all participant IDs that have ever been part of this contest in Redis.

  async getAllKnownParticipants(cid: string): Promise<string[]> {
    const s = this.setKeys(cid);
    const p = redis.pipeline();
    p.smembers(s.waiting);
    p.smembers(s.active);
    p.smembers(s.submitted);
    p.smembers(s.disconnected);
    const results = await p.exec();
    const ids = new Set<string>();
    for (const r of results ?? []) {
      for (const pid of ((r?.[1] as string[]) ?? [])) ids.add(pid);
    }
    return [...ids];
  }
}
