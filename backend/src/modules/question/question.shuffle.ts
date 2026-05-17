/**
 * question.shuffle.ts
 *
 * Pure shuffle utilities for question and option ordering.
 *
 * Design decisions:
 *  - Seeded PRNG (mulberry32) so the SAME seed always produces the SAME shuffle.
 *    This means a participant who disconnects and reconnects gets identical
 *    question order without storing the full shuffled list in Redis.
 *    Only the seed needs to be stored.
 *
 *  - Two independent shuffle passes:
 *      1. Question order  (controlled by contest.shuffleQuestions)
 *      2. Options order   (controlled by contest.shuffleOptions)
 *         → uses a derived seed per question so each question's options
 *           are shuffled differently but still deterministically.
 *
 *  - No side effects. No I/O. Fully unit-testable.
 */

import {
    ParticipantQuestionView,
    ParticipantOptionView,
    ShuffledQuestionSet,
} from "./question.types";

// ─── Seeded PRNG — mulberry32 ─────────────────────────────────────────────────

/**
 * Returns a pseudo-random number generator seeded with `seed`.
 * mulberry32 is fast, good enough for shuffling, and deterministic.
 */
function createPrng(seed: number): () => number {
    let s = seed;
    return function () {
        s |= 0;
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Convert a string seed (e.g. participantId + contestId) into a numeric seed.
 */
function hashSeed(str: string): number {
    let hash = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0; // FNV prime, keep 32-bit
    }
    return hash;
}

// ─── Fisher-Yates in-place shuffle with PRNG ─────────────────────────────────

function shuffleArray<T>(arr: T[], prng: () => number): T[] {
    const result = [...arr]; // never mutate the input
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(prng() * (i + 1));
        const temp = result[i];
        result[i] = result[j] as T;
        result[j] = temp as T;
    }
    return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a deterministic seed string for a participant's quiz session.
 * Combining participantId + contestId guarantees:
 *   - Different participants see different orders
 *   - Same participant always sees the same order on reconnect
 */
export function buildSessionSeed(participantId: string, contestId: string): string {
    return `${participantId}:${contestId}`;
}

/**
 * shuffleQuestionsForParticipant
 *
 * Takes the admin-ordered question list and returns a shuffled view
 * tailored to one participant. Correct answer data is STRIPPED here —
 * this is the single enforcement point that ensures isCorrect never
 * reaches a participant over the wire.
 *
 * @param questions     - Full ordered question list from the repository
 * @param sessionSeed   - Deterministic seed string (from buildSessionSeed)
 * @param shuffleQ      - contest.shuffleQuestions flag
 * @param shuffleOpts   - contest.shuffleOptions flag
 */
export function shuffleQuestionsForParticipant(
    questions: Array<{
        marks: number;
        negativeMark: any; // Prisma.Decimal
        question: {
            id: string;
            questionText: string;
            hint: string | null;
            options: Array<{ id: string; text: string; position: number; isCorrect: boolean }>;
        };
    }>,
    sessionSeed: string,
    shuffleQ: boolean,
    shuffleOpts: boolean
): ShuffledQuestionSet {
    const numericSeed = hashSeed(sessionSeed);
    const questionPrng = createPrng(numericSeed);

    // 1. Strip correct-answer data from all questions first
    const stripped: ParticipantQuestionView[] = questions.map((cq) => ({
        id: cq.question.id,
        questionText: cq.question.questionText,
        hint: cq.question.hint,
        marks: cq.marks || 0,
        negativeMark: Number(cq.negativeMark) || 0,
        options: cq.question.options.map(
            (opt): ParticipantOptionView => ({
                id: opt.id,
                text: opt.text,
                position: opt.position,
                // isCorrect deliberately NOT included
            })
        ),
    }));

    // 2. Shuffle question order if enabled
    const orderedQuestions = shuffleQ
        ? shuffleArray(stripped, questionPrng)
        : stripped;

    // 3. Shuffle option order per question if enabled
    //    Each question gets its own derived seed to avoid correlated shuffles.
    const finalQuestions = orderedQuestions.map((q) => {
        if (!shuffleOpts) return q;

        // Derive a per-question seed so options for Q1 and Q2 are shuffled differently
        const optionPrng = createPrng(hashSeed(`${sessionSeed}:${q.id}`));
        return {
            ...q,
            options: shuffleArray(q.options, optionPrng),
        };
    });

    return {
        questions: finalQuestions,
        sessionSeed,
    };
}

/**
 * replayShuffleFromSeed
 *
 * Re-derives the same shuffled question order from a stored seed.
 * Used when a participant reconnects mid-quiz — we don't store the full
 * shuffled list in Redis, just the seed string. This function reproduces
 * the exact same order instantly.
 */
export function replayShuffleFromSeed(
    questions: Parameters<typeof shuffleQuestionsForParticipant>[0],
    sessionSeed: string,
    shuffleQ: boolean,
    shuffleOpts: boolean
): ShuffledQuestionSet {
    // Identical logic — determinism guarantees same output for same seed
    return shuffleQuestionsForParticipant(questions, sessionSeed, shuffleQ, shuffleOpts);
}