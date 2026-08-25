/**
 * Loads the shared skill catalogue once, for any component that needs to offer it.
 *
 * WHY THIS EXISTS. Three places now need the same list: the opportunity form's two
 * skill pickers, and the student's skill filter. Each fetching its own copy would
 * be three requests for one unchanging list and three copies of the same
 * loading/error handling to keep in step.
 *
 * The effect body is lifted verbatim from components/profile/SkillsSection.jsx,
 * which predates this hook. That component is shipped and tested, so it has been
 * left as it is rather than rewritten to use this — the same call made for
 * InterestsField and ChipListField. If the profile page is next touched for its own
 * reasons, folding it in here is the obvious cleanup.
 *
 * Not cached across mounts on purpose. A module-level cache would need
 * invalidation, and `npm run seed` changing the catalogue mid-session is exactly
 * the kind of thing a hackathon demo does.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchSkills } from '../api/catalogue.api.js';

export default function useSkillCatalogue() {
  const [catalogue, setCatalogue] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loaded = await fetchSkills();
      if (isMounted.current) setCatalogue(loaded);
      return loaded;
    } catch (caught) {
      if (isMounted.current) setError(caught);
      return null;
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { catalogue, isLoading, error, reload: load };
}
