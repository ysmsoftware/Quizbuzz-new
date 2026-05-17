/**
 * Quiz Session Helper — Redis Key Patterns & Operations
 *
 * Strictly follows the engineering guidelines for key naming:
 *   quiz:{contestId}:questions:{participantId}   ← shuffled question order
 *   quiz:{contestId}:answers:{participantId}     ← in-progress answers
 *   quiz:{contestId}:session:{participantId}     ← current question index / phase
 *   quiz:{contestId}:heartbeat:{participantId}   ← alive signal
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

const SESSION_TTL = config.redis.ttl.quizSession;
const HEARTBEAT_TTL = config.redis.ttl.heartbeat;

export class QuizSession {
  // ─── Key Builders ─────────────────────────────────────────────────────────────

  private keys(cid: string, pid: string) {
    return {
      session:   `quiz:${cid}:session:${pid}`,
      answers:   `quiz:${cid}:answers:${pid}`,
      heartbeat: `quiz:${cid}:heartbeat:${pid}`,
      questions: `quiz:${cid}:questions:${pid}`,
      ready:     `quiz:${cid}:ready:${pid}`,
      violations: `quiz:${cid}:violations:${pid}`,
    };
  }

  private globalKeys(cid: string) {
    return {
      waiting: `quiz:${cid}:waiting`,
      active:  `quiz:${cid}:active`,
      live:    `quiz:${cid}:live`,
    };
  }

  // ─── Session Management ───────────────────────────────────────────────────

  async createSession(state: QuizSessionState): Promise<void> {
    const k = this.keys(state.contestId, state.participantId);
    const flat: Record<string, string> = {
      organizationId: state.organizationId,
      contactId: state.contactId,
      socketId: state.socketId,
      phase: state.phase,
      seed: state.seed,
      startedAt: state.startedAt,
      currentQuestion: String(state.currentQuestion),
      totalQuestions: String(state.totalQuestions),
      contestEndTime: state.contestEndTime,
      violationCount: String(state.violationCount),
      lastHeartbeatAt: state.lastHeartbeatAt,
    };

    const pipeline = redis.pipeline();
    pipeline.hset(k.session, flat);
    pipeline.expire(k.session, SESSION_TTL);
    await pipeline.exec();
  }

  async getSession(contestId: string, participantId: string): Promise<QuizSessionState | null> {
    const k = this.keys(contestId, participantId);
    const data = await redis.hgetall(k.session);
    if (!data || !data.contactId) return null;

    return {
      contestId,
      participantId,
      organizationId: data.organizationId || "",
      contactId: data.contactId || "",
      socketId: data.socketId || "",
      phase: (data.phase as QuizPhase) || "WAITING",
      seed: data.seed || "",
      startedAt: data.startedAt || "",
      currentQuestion: parseInt(data.currentQuestion || "0", 10),
      totalQuestions: parseInt(data.totalQuestions || "0", 10),
      contestEndTime: data.contestEndTime || "",
      violationCount: parseInt(data.violationCount || "0", 10),
      lastHeartbeatAt: data.lastHeartbeatAt || "",
    };
  }

  async updatePhase(contestId: string, participantId: string, phase: QuizPhase): Promise<void> {
    await redis.hset(this.keys(contestId, participantId).session, "phase", phase);
  }

  // ─── Questions (Shuffled Order) ───────────────────────────────────────────

  async saveQuestionOrder(contestId: string, participantId: string, questionIds: string[]): Promise<void> {
    const key = this.keys(contestId, participantId).questions;
    await redis.set(key, JSON.stringify(questionIds), "EX", SESSION_TTL);
  }

  async getQuestionOrder(contestId: string, participantId: string): Promise<string[] | null> {
    const raw = await redis.get(this.keys(contestId, participantId).questions);
    return raw ? JSON.parse(raw) : null;
  }

  // ─── Answers ──────────────────────────────────────────────────────────────

  async saveAnswer(contestId: string, participantId: string, questionId: string, answer: SavedAnswer): Promise<void> {
    const k = this.keys(contestId, participantId);
    
    // Use a Lua script for atomic check-and-increment to prevent race conditions
    // Script: if answer doesn't exist, increment currentQuestion; then save answer
    const luaScript = `
      local answersKey = KEYS[1]
      local sessionKey = KEYS[2]
      local questionId = ARGV[1]
      local answerData = ARGV[2]
      local ttl = tonumber(ARGV[3])
      
      -- Check if this is a new answer (doesn't exist yet)
      local isNew = redis.call('HEXISTS', answersKey, questionId)
      
      -- Save the answer
      redis.call('HSET', answersKey, questionId, answerData)
      redis.call('EXPIRE', answersKey, ttl)
      
      -- If it's a new answer, increment currentQuestion
      if isNew == 0 then
        redis.call('HINCRBY', sessionKey, 'currentQuestion', 1)
      end
      
      return 1
    `;

    await redis.eval(luaScript, 2, k.answers, k.session, questionId, JSON.stringify(answer), SESSION_TTL);
  }

  async getAllAnswers(contestId: string, participantId: string): Promise<Record<string, SavedAnswer>> {
    const raw = await redis.hgetall(this.keys(contestId, participantId).answers);
    const result: Record<string, SavedAnswer> = {};
    for (const [qid, json] of Object.entries(raw)) {
      result[qid] = JSON.parse(json);
    }
    return result;
  }

  // ─── Heartbeat ────────────────────────────────────────────────────────────

  async refreshHeartbeat(contestId: string, participantId: string): Promise<void> {
    const k = this.keys(contestId, participantId);
    const pipeline = redis.pipeline();
    pipeline.set(k.heartbeat, "1", "EX", HEARTBEAT_TTL);
    pipeline.hset(k.session, "lastHeartbeatAt", new Date().toISOString());
    await pipeline.exec();
  }

  async isAlive(contestId: string, participantId: string): Promise<boolean> {
    return (await redis.exists(this.keys(contestId, participantId).heartbeat)) === 1;
  }

  // ─── Waiting Room & Active Sets ───────────────────────────────────────────

  async addToWaitingRoom(contestId: string, participantId: string): Promise<void> {
    await redis.sadd(this.globalKeys(contestId).waiting, participantId);
  }

  async removeFromWaitingRoom(contestId: string, participantId: string): Promise<void> {
    await redis.srem(this.globalKeys(contestId).waiting, participantId);
  }

  async addToActive(contestId: string, participantId: string): Promise<void> {
    await redis.sadd(this.globalKeys(contestId).active, participantId);
  }

  async removeFromActive(contestId: string, participantId: string): Promise<void> {
    await redis.srem(this.globalKeys(contestId).active, participantId);
  }

  async getWaitingCount(contestId: string): Promise<number> {
    return redis.scard(this.globalKeys(contestId).waiting);
  }

  async getActiveCount(contestId: string): Promise<number> {
    return redis.scard(`quiz:${contestId}:active`);
  }

  async getActiveMembers(contestId: string, type: "waiting" | "active" | "live" = "active"): Promise<string[]> {
    const key = this.globalKeys(contestId)[type];
    return redis.smembers(key);
  }

  // ─── Readiness ────────────────────────────────────────────────────────────

  async setReadiness(contestId: string, participantId: string, field: keyof ReadinessState, value: boolean): Promise<void> {
    const k = this.keys(contestId, participantId);
    await redis.hset(k.ready, field, value ? "1" : "0");
    await redis.expire(k.ready, SESSION_TTL);
  }

  async getReadiness(contestId: string, participantId: string): Promise<ReadinessState> {
    const data = await redis.hgetall(this.keys(contestId, participantId).ready);
    return {
      camera: data.camera === "1",
      otp: data.otp === "1",
      joincode: data.joincode === "1",
    };
  }

  // ─── Violations ───────────────────────────────────────────────────────────

  async recordViolation(contestId: string, participantId: string, violation: ViolationEvent): Promise<number> {
    const k = this.keys(contestId, participantId);
    const pipeline = redis.pipeline();
    pipeline.rpush(k.violations, JSON.stringify(violation));
    pipeline.hincrby(k.session, "violationCount", 1);
    const results = await pipeline.exec();
    return (results?.[0]?.[1] as number) ?? 0;
  }

  async getViolations(contestId: string, participantId: string): Promise<ViolationEvent[]> {
    const k = this.keys(contestId, participantId);
    const data = await redis.lrange(k.violations, 0, -1);
    return data.map(v => JSON.parse(v));
  }

  async getViolationCount(contestId: string, participantId: string): Promise<number> {
    const k = this.keys(contestId, participantId);
    return redis.llen(k.violations);
  }
}
