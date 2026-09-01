/**
 * Cache-aside helpers for a contest's scoring configuration (marks, negative
 * marks, correct options — the read evaluation.worker.ts's "load_scoring_config"
 * step needs once per evaluation job, identical for every participant in the
 * same contest).
 *
 * Deliberately kept in its own file, independent of both QuestionService and
 * ContestService: ContestService.updateContest's applyToExistingQuestions path
 * bulk-updates marks/negativeMark and needs to invalidate this cache, but
 * QuestionService already imports ContestService (see question.service.ts's
 * IContestContextProvider comment — "keeps the two modules loosely coupled
 * with no circular import"). Importing QuestionService back into
 * ContestService would create exactly that circular import, so the key
 * builder and the invalidation call live here instead, with no dependency on
 * either service.
 */
import { redis } from "../../config/redis";
import { config } from "../../config";
import logger from "../../config/logger";

export function contestScoringConfigCacheKey(contestId: string, organizationId: string): string {
    return `contest:scoring-config:${organizationId}:${contestId}`;
}

/**
 * Call after any write that changes a contest's scoring-relevant rows:
 * assigning/removing a question, editing one question's marks/negativeMark,
 * or a contest-level bulk mark update. Cache is a performance optimization,
 * not a source of truth — a Redis failure here is logged and swallowed
 * rather than failing the write that triggered it.
 */
export async function invalidateContestScoringConfigCache(
    contestId: string,
    organizationId: string,
): Promise<void> {
    if (config.contest.scoringConfigCacheTtlSeconds <= 0) return; // caching disabled — nothing to invalidate
    try {
        await redis.del(contestScoringConfigCacheKey(contestId, organizationId));
    } catch (err) {
        logger.warn(
            `[scoring-config-cache] Invalidation failed for contest ${contestId}: ${(err as Error).message}`,
        );
    }
}
