/**
 * Assessment constants — the single source of truth for the scoring engine.
 *
 * WHY THESE NUMBERS LIVE HERE. The score a student sees on their dashboard, the
 * gap analysis in Phase 3 and the match score in Phase 5 all have to agree about
 * what "70" means. If the option weights were typed into the question bank and
 * the band table were typed into the UI, the three would drift apart the first
 * time one was edited. Skill levels reuse `constants/skills.js` (0-100) so an
 * assessed score can be written straight into `StudentProfile.skills[].level`
 * with no conversion — conversions are where rounding bugs hide.
 */

export const ASSESSMENT_STATUSES = Object.freeze({
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  ABANDONED: 'abandoned',
});

export const ASSESSMENT_STATUS_VALUES = Object.freeze(Object.values(ASSESSMENT_STATUSES));

/**
 * Where the questions came from. Recorded per attempt, not globally, because
 * the AI can be configured halfway through a demo and a submitted attempt must
 * stay honest about how it was generated.
 */
export const QUESTION_SOURCES = Object.freeze({
  BANK: 'bank',
  AI: 'ai',
});

export const QUESTION_SOURCE_VALUES = Object.freeze(Object.values(QUESTION_SOURCES));

export const DIFFICULTIES = Object.freeze({
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
});

export const DIFFICULTY_VALUES = Object.freeze(Object.values(DIFFICULTIES));

/** MVP is a fixed-length paper. No adaptive testing (his brief rules it out). */
export const DEFAULT_QUESTION_COUNT = 10;
export const MIN_QUESTION_COUNT = 5;
export const MAX_QUESTION_COUNT = 20;

/** Every question offers exactly four options. */
export const OPTIONS_PER_QUESTION = 4;

/**
 * The four option weights, best to worst.
 *
 * Partial credit rather than right/wrong: a student who picks the "nearly right"
 * answer knows more than one who picks nonsense, and a 0/100 scheme cannot say
 * so. Four questions on a skill then resolve to 25 distinct scores instead of 5,
 * which is what makes `requiredLevel - studentScore` a useful number in Phase 3
 * instead of a staircase.
 */
export const OPTION_SCORES = Object.freeze([100, 67, 33, 0]);

/** An unanswered question scores zero — it is not skipped, or the paper shortens. */
export const UNANSWERED_SCORE = 0;

export default ASSESSMENT_STATUSES;
