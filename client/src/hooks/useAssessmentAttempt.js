/**
 * One assessment attempt: the paper, the answers in progress, and the submit.
 *
 * ANSWERS LIVE IN THE BROWSER UNTIL SUBMIT. There is no per-answer PATCH
 * endpoint, so choosing an option is instant and free — no spinner on every
 * click, no way for a slow network to lose the answer a student just gave. The
 * cost is honest and bounded: a refresh mid-paper loses the selections, and the
 * page says so before it matters rather than pretending otherwise.
 *
 * The paper's own `selectedOptionIndex` seeds the local state anyway, so if a
 * later phase does start saving answers as they are made, resuming picks them up
 * without this hook changing.
 *
 * WHY `answers` IS AN OBJECT AND NOT AN ARRAY. Keyed by question index, absence
 * means unanswered — which is exactly what the submit payload needs, since the
 * server treats a missing question as a zero rather than requiring a sentinel.
 * An array would need holes, and `[undefined, 2]` is a worse thing to reason
 * about than `{ 1: 2 }`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchAssessment, submitAssessment } from '../api/assessment.api.js';

/** `{ 0: 2, 3: 1 }` from a paper's own stored selections. */
const seedAnswers = (paper) => {
  const seeded = {};
  for (const question of paper?.questions ?? []) {
    if (question.selectedOptionIndex !== null && question.selectedOptionIndex !== undefined) {
      seeded[question.index] = question.selectedOptionIndex;
    }
  }
  return seeded;
};

/**
 * @param {string | undefined} assessmentId
 */
export default function useAssessmentAttempt(assessmentId) {
  const [assessment, setAssessment] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(assessmentId));
  const [loadError, setLoadError] = useState(null);

  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!assessmentId) {
      setAssessment(null);
      setIsLoading(false);
      return null;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const loaded = await fetchAssessment(assessmentId);
      if (isMounted.current) {
        setAssessment(loaded);
        setAnswers(seedAnswers(loaded));
        setCurrentIndex(0);
      }
      return loaded;
    } catch (error) {
      if (isMounted.current) {
        setLoadError(error);
        setAssessment(null);
      }
      return null;
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const questions = assessment?.questions ?? [];
  const total = questions.length;

  /** Clamped, so a paper that loads shorter than the stored index cannot blank the page. */
  const safeIndex = total === 0 ? 0 : Math.min(currentIndex, total - 1);
  const currentQuestion = questions[safeIndex] ?? null;

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const isFirst = safeIndex === 0;
  const isLast = total > 0 && safeIndex === total - 1;

  const selectOption = useCallback(
    (optionIndex) => {
      if (!currentQuestion) return;
      // Clearing an answer is deliberate: re-clicking the chosen option removes
      // it, so "I would rather not guess" stays expressible. Guessing is never
      // worse than skipping under this scoring, but the student decides.
      setAnswers((previous) => {
        const next = { ...previous };
        if (next[currentQuestion.index] === optionIndex) delete next[currentQuestion.index];
        else next[currentQuestion.index] = optionIndex;
        return next;
      });
      setSubmitError(null);
    },
    [currentQuestion],
  );

  const goTo = useCallback(
    (index) => {
      if (total === 0) return;
      setCurrentIndex(Math.min(Math.max(index, 0), total - 1));
    },
    [total],
  );

  const goNext = useCallback(() => goTo(safeIndex + 1), [goTo, safeIndex]);
  const goPrevious = useCallback(() => goTo(safeIndex - 1), [goTo, safeIndex]);

  /**
   * Submits and returns the scored result, or null on failure.
   *
   * Deliberately allowed with questions unanswered. The server scores those zero
   * and keeps them in the denominator, so an incomplete paper produces a real —
   * lower — score rather than a blocked button and a student stuck on question 7.
   */
  const submit = useCallback(async () => {
    if (!assessmentId) return null;

    setIsSubmitting(true);
    setSubmitError(null);

    const payload = Object.entries(answers).map(([questionIndex, optionIndex]) => ({
      questionIndex: Number(questionIndex),
      optionIndex,
    }));

    try {
      const scored = await submitAssessment(assessmentId, payload);
      if (isMounted.current) setResult(scored);
      return scored;
    } catch (error) {
      if (isMounted.current) setSubmitError(error);
      return null;
    } finally {
      if (isMounted.current) setIsSubmitting(false);
    }
  }, [answers, assessmentId]);

  return {
    assessment,
    isLoading,
    loadError,
    reload: load,

    questions,
    total,
    currentQuestion,
    currentIndex: safeIndex,
    isFirst,
    isLast,
    goTo,
    goNext,
    goPrevious,

    answers,
    answeredCount,
    selectedOptionIndex: currentQuestion ? (answers[currentQuestion.index] ?? null) : null,
    selectOption,

    submit,
    isSubmitting,
    submitError,
    result,
  };
}
