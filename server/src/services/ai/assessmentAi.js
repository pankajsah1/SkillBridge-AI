/**
 * assessmentAi.js — the provider-agnostic AI service the rest of the app calls.
 *
 * ONE PUBLIC FUNCTION: `generateAssessmentQuestions({ careerRole, skills, count })`.
 * It returns an array of canonical questions, or **null**. Null is not an error
 * condition to be handled specially; it is the ordinary answer meaning "use the
 * bank". Every caller treats it that way, which is why a missing key, a dead
 * network, an exhausted quota and a hallucinated response all end in the same
 * place with no branching.
 *
 * THIS FUNCTION NEVER THROWS AND NEVER RETURNS A PARTIAL PAPER. A paper that is
 * half AI-generated and half bank would be impossible to reason about when a
 * score looks wrong. Either the whole generated set validates or the whole thing
 * is discarded.
 *
 * WHAT THE AI IS AND IS NOT ALLOWED TO DO HERE.
 * It writes question text and option text. It does not compute anything. Option
 * weights come from `OPTION_SCORES`, skill scores are averaged in
 * assessment.service.js, and readiness is arithmetic. A model that returns a
 * score field is ignored — a number a student cannot have explained to them has
 * no business on their profile.
 *
 * THE CANONICAL SHAPE, chosen once so the adapter has a fixed target
 * (TRD section 14):
 *
 *     { questionText, skillSlug, difficulty, options: [{ text, score }] }
 *
 * A model that answers in the common `{ options: ['A','B','C','D'], correctAnswer }`
 * form is normalised into it by `normaliseQuestion` below.
 */

import {
  DIFFICULTIES,
  DIFFICULTY_VALUES,
  OPTIONS_PER_QUESTION,
  OPTION_SCORES,
} from '../../constants/assessments.js';
import { isAiConfigured } from '../../config/env.js';
import { requestCompletion } from './aiProvider.js';

const SYSTEM_PROMPT = [
  'You write multiple-choice questions that measure a specific technical or professional skill.',
  'Reply with JSON only. No markdown fences, no commentary.',
  'Each question must have exactly four distinct options, ordered from most correct to least correct.',
  'The first option must be clearly correct. The second must be plausible but weaker.',
  'The third must be a common misconception. The fourth must be clearly wrong.',
  'Never mention the ordering or the correctness in the option text itself.',
].join(' ');

/** Kept small and explicit: the model is told the exact key names to use. */
const buildUserPrompt = ({ careerRole, skills, count }) => {
  const skillList = skills.map((skill) => `- ${skill.slug}: ${skill.name}`).join('\n');

  return [
    `Write ${count} multiple-choice questions for a candidate targeting the role: ${careerRole || 'general software engineering'}.`,
    '',
    'Measure these skills, using the slug exactly as given:',
    skillList,
    '',
    'Spread the questions across the skills listed. Vary difficulty between easy, medium and hard.',
    '',
    'Respond with this exact JSON structure:',
    '{"questions":[{"questionText":"...","skillSlug":"...","difficulty":"easy|medium|hard","options":["most correct","plausible but weaker","common misconception","clearly wrong"]}]}',
  ].join('\n');
};

/**
 * Pulls the JSON object out of the reply.
 *
 * Models wrap JSON in prose or a fenced block however firmly they are told not
 * to, so a strict `JSON.parse` of the whole reply throws away usable answers.
 * The brace-slice is a pragmatic second attempt, not a parser.
 */
const parseJsonObject = (text) => {
  const attempt = (candidate) => {
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  };

  const direct = attempt(text.trim());
  if (direct) return direct;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const unfenced = attempt(fenced[1].trim());
    if (unfenced) return unfenced;
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return attempt(text.slice(firstBrace, lastBrace + 1));
  }

  return null;
};

/** `correctAnswer` may be an index, a letter or the option text itself. */
const resolveCorrectIndex = (raw, optionTexts) => {
  if (raw === null || raw === undefined) return 0;

  if (typeof raw === 'number' && Number.isInteger(raw)) {
    return raw >= 0 && raw < optionTexts.length ? raw : 0;
  }

  const asString = String(raw).trim();

  if (/^[A-Da-d]$/.test(asString)) return asString.toUpperCase().charCodeAt(0) - 65;

  const asNumber = Number.parseInt(asString, 10);
  if (Number.isInteger(asNumber) && asNumber >= 0 && asNumber < optionTexts.length) return asNumber;

  const byText = optionTexts.findIndex((text) => text.trim().toLowerCase() === asString.toLowerCase());
  return byText === -1 ? 0 : byText;
};

/**
 * Normalises one raw question, or returns null if it cannot be trusted.
 *
 * Rejection is cheap and silent: one bad question discards the whole generated
 * paper, and the bank takes over. That is a better outcome than shipping a
 * question with two identical options into a live demo.
 */
const normaliseQuestion = (raw, allowedSlugs) => {
  if (!raw || typeof raw !== 'object') return null;

  const questionText = String(raw.questionText ?? raw.question ?? raw.text ?? '').trim();
  if (questionText.length < 10 || questionText.length > 500) return null;

  const skillSlug = String(raw.skillSlug ?? raw.skill ?? raw.skillId ?? '')
    .trim()
    .toLowerCase();
  // A question attributed to a skill we did not ask about cannot be scored
  // against the catalogue, so it is unusable rather than merely off-topic.
  if (!allowedSlugs.has(skillSlug)) return null;

  const difficultyRaw = String(raw.difficulty ?? '').trim().toLowerCase();
  const difficulty = DIFFICULTY_VALUES.includes(difficultyRaw) ? difficultyRaw : DIFFICULTIES.MEDIUM;

  const rawOptions = Array.isArray(raw.options) ? raw.options : null;
  if (!rawOptions || rawOptions.length !== OPTIONS_PER_QUESTION) return null;

  // Options arrive either as plain strings or as objects with a text field.
  const optionTexts = rawOptions.map((option) =>
    typeof option === 'string' ? option.trim() : String(option?.text ?? option?.option ?? '').trim(),
  );
  if (optionTexts.some((text) => text.length === 0 || text.length > 300)) return null;

  // Duplicate options make a question unanswerable and are a common failure.
  const distinct = new Set(optionTexts.map((text) => text.toLowerCase()));
  if (distinct.size !== optionTexts.length) return null;

  const hasCorrectAnswerField =
    raw.correctAnswer !== undefined || raw.correctIndex !== undefined || raw.answer !== undefined;

  let options;
  if (hasCorrectAnswerField) {
    // The right-or-wrong form carries no ranking for the distractors, so partial
    // credit is not available: correct scores full, everything else scores zero.
    // Inventing an order would be inventing a score.
    const correctIndex = resolveCorrectIndex(
      raw.correctAnswer ?? raw.correctIndex ?? raw.answer,
      optionTexts,
    );
    options = optionTexts.map((text, index) => ({
      text,
      score: index === correctIndex ? OPTION_SCORES[0] : OPTION_SCORES[OPTION_SCORES.length - 1],
    }));
  } else {
    // The prompt asked for best-to-worst order, so the shared weights apply.
    options = optionTexts.map((text, index) => ({ text, score: OPTION_SCORES[index] }));
  }

  return { bankId: '', questionText, skillSlug, difficulty, options };
};

/**
 * Asks the configured provider for a paper.
 *
 * @param   {{careerRole?: string, skills: Array<{slug: string, name: string}>, count: number}} input
 * @returns {Promise<Array|null>} canonical questions, or null to use the bank
 */
export const generateAssessmentQuestions = async ({ careerRole = '', skills = [], count = 10 } = {}) => {
  if (!isAiConfigured()) return null;
  if (skills.length === 0 || count < 1) return null;

  const { ok, text, reason } = await requestCompletion({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt({ careerRole, skills, count }),
  });

  if (!ok) {
    console.warn(`[ai] question generation unavailable (${reason}) — using the deterministic bank`);
    return null;
  }

  const payload = parseJsonObject(text);
  const rawQuestions = Array.isArray(payload) ? payload : payload?.questions;

  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    console.warn('[ai] response did not contain a questions array — using the deterministic bank');
    return null;
  }

  const allowedSlugs = new Set(skills.map((skill) => skill.slug));
  const normalised = rawQuestions.slice(0, count).map((raw) => normaliseQuestion(raw, allowedSlugs));

  if (normalised.some((question) => question === null)) {
    console.warn('[ai] response contained malformed questions — using the deterministic bank');
    return null;
  }

  // A short paper would silently change the assessment length, so it is refused.
  if (normalised.length < count) {
    console.warn(
      `[ai] response had ${normalised.length} usable questions, needed ${count} — using the deterministic bank`,
    );
    return null;
  }

  return normalised.map((question, index) => ({ ...question, bankId: `ai-${index + 1}` }));
};

/** Exported for the test suite; not part of the service contract. */
export { normaliseQuestion, parseJsonObject, resolveCorrectIndex };

export default generateAssessmentQuestions;
