/**
 * Turning a rejected API call into something a component can render.
 *
 * axiosInstance normalises every failure to
 * `{ status, message, errors, isNetworkError }`, where `errors` is the server's
 * `{ field, message }[]`. These two helpers cover the only two things a UI ever
 * wants to do with that array.
 *
 * WHY THIS IS A SEPARATE FILE AND NOT A CHANGE TO useStudentProfile.js. Step 3's
 * hook has the same field-mapping loop inline. It is shipped, tested and works;
 * rewriting it to import from here would be a refactor of working code for no
 * behavioural gain, which the build brief asks me not to do. New code uses these
 * helpers, and if Step 3's hook is ever touched for its own reasons, that is the
 * moment to fold it in.
 */

/**
 * Maps a rejection's field-level messages to `{ field: message }`.
 *
 * The first message for a field wins. Later ones are dropped rather than
 * concatenated, because two sentences crammed under one input is worse than the
 * most important sentence alone — and the server lists the most specific failure
 * first.
 *
 * Field names are the server's paths verbatim (`eligibility.branches`,
 * `requiredSkills[0].requiredLevel`), so a form keyed the same way can look them
 * up with no translation.
 *
 * @param {{errors?: Array<{field?: string, message?: string}>}} [error]
 * @returns {Record<string, string>}
 */
export const fieldErrorsFrom = (error) => {
  const mapped = {};

  for (const item of error?.errors ?? []) {
    if (item?.field && item?.message && !mapped[item.field]) mapped[item.field] = item.message;
  }

  return mapped;
};

/**
 * Every detail message, stripped of its field, for a banner on a page that has no
 * matching input.
 *
 * Alert deliberately hides fielded messages, on the assumption that they are
 * being shown beside their input. That assumption holds on a form and fails on a
 * list: "Choose a new deadline before reopening this opportunity" is the only
 * actionable half of that error, and there is no deadline box on the list page to
 * put it next to. Dropping the field is what makes it visible there.
 *
 * @param {{errors?: Array<{field?: string, message?: string}>}} [error]
 * @returns {Array<{message: string}>}
 */
export const errorDetailsForBanner = (error) =>
  (error?.errors ?? [])
    .filter((item) => item?.message)
    .map((item) => ({ message: item.message }));

export default { fieldErrorsFrom, errorDetailsForBanner };
