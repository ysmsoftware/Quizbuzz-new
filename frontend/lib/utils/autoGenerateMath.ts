/**
 * Mirrors the target-count math in
 * backend/src/modules/question/question.service.ts (`autoGenerateQuestions`)
 * EXACTLY — same Math.floor-then-round-robin-remainder approach, in the same
 * order — so a frontend preflight check ("is there enough for what we're
 * about to ask for?") is asking about the identical numbers the backend will
 * actually try to select. If the backend's rounding logic ever changes,
 * update this file too or the two will silently drift apart.
 */

export interface AutoGenerateRule {
  tags: string[];
  percentage: number;
  difficultyDistribution: { EASY: number; MEDIUM: number; HARD: number };
}

export interface RuleTarget<T extends AutoGenerateRule> {
  rule: T;
  target: number;
}

export function computeRuleTargets<T extends AutoGenerateRule>(
  totalQuestions: number,
  rules: T[]
): RuleTarget<T>[] {
  const ruleTargets: RuleTarget<T>[] = rules.map((rule) => ({
    rule,
    target: Math.floor((rule.percentage / 100) * totalQuestions),
  }));

  const currentSum = ruleTargets.reduce((sum, r) => sum + r.target, 0);
  let remainder = totalQuestions - currentSum;
  let idx = 0;
  while (remainder > 0 && ruleTargets.length > 0) {
    ruleTargets[idx % ruleTargets.length]!.target += 1;
    remainder--;
    idx++;
  }

  return ruleTargets;
}

export interface DifficultyTarget {
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  target: number;
}

export function computeDifficultyTargets(
  targetForRule: number,
  difficultyDistribution: { EASY: number; MEDIUM: number; HARD: number }
): DifficultyTarget[] {
  const difficulties = ['EASY', 'MEDIUM', 'HARD'] as const;
  const diffTargets: DifficultyTarget[] = difficulties.map((difficulty) => ({
    difficulty,
    target: Math.floor(((difficultyDistribution[difficulty] || 0) / 100) * targetForRule),
  }));

  const diffSum = diffTargets.reduce((sum, d) => sum + d.target, 0);
  let remainder = targetForRule - diffSum;
  let idx = 0;
  while (remainder > 0) {
    diffTargets[idx % diffTargets.length]!.target += 1;
    remainder--;
    idx++;
  }

  return diffTargets;
}
