/**
 * The institution intelligence report, held for one page.
 *
 * A THIN WRAPPER OVER ONE ENDPOINT. Every band, share, gap, priority, sentence and
 * action in the response was decided by the server; this hook fetches them, keeps
 * them and offers a reload. It sorts nothing and computes nothing, because a second
 * ranking computed in the browser would eventually disagree with the one the
 * dashboard shows for the same cohort.
 *
 * `coverage` IS WHY THERE IS NO SECTION-LEVEL LOADING STATE. One request answers the
 * whole page, and the server says per section whether it has enough data to be
 * believed — so a thin section can say "not enough yet" while the rest renders. That
 * is a successful response, not an error, and it is deliberately not flattened into
 * `loadError`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchInstitutionIntelligence } from '../api/analytics.api.js';

/** What "no answer yet" looks like, so no consumer has to guard on null. */
const emptyCoverage = () => ({
  hasStudents: false,
  hasAssessments: false,
  hasLivePostings: false,
  hasLearningData: false,
  hasReassessmentData: false,
  hasApplications: false,
});

export default function useInstitutionIntelligence({ autoLoad = true } = {}) {
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [loadError, setLoadError] = useState(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const loaded = await fetchInstitutionIntelligence();
      if (isMounted.current) setReport(loaded);
      return loaded;
    } catch (error) {
      if (isMounted.current) {
        setLoadError(error);
        /* Cleared, because a half-rendered report under an error banner invites the
           reader to act on figures the server has just failed to confirm. */
        setReport(null);
      }
      return null;
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) load();
  }, [autoLoad, load]);

  return {
    report,
    institution: report?.institution ?? null,
    summary: report?.summary ?? null,
    skillDemand: report?.skillDemand ?? null,
    skillGaps: report?.skillGaps ?? [],
    learningImpact: report?.learningImpact ?? null,
    outcomes: report?.outcomes ?? null,
    actions: report?.actions ?? [],
    coverage: report?.coverage ?? emptyCoverage(),
    isLoading,
    loadError,
    reload: load,
  };
}
