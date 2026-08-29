/**
 * Portfolio vocabulary for the client.
 *
 * MIRRORS server/src/constants/portfolio.js, and mirrors it deliberately rather
 * than fetching it. The values are compile-time constants that only change when
 * the model changes, and a request to learn what "hackathon" is called in English
 * would add a loading state to every form for no benefit.
 *
 * The rule that keeps a mirror honest: THIS FILE HOLDS LABELS, THE SERVER HOLDS
 * TRUTH. Nothing here scores, validates authoritatively, or decides what is
 * verified. If a value drifts, the symptom is a wrong label — never a wrong
 * number and never an accepted-but-invalid record, because the server re-checks
 * every field it stores.
 */

export const VERIFICATION_STATUSES = Object.freeze({
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
});

/**
 * How each status reads to a student, and how it looks.
 *
 * "Awaiting verification" rather than "Pending" because pending-what is the
 * student's actual question. The wording is careful not to imply that something
 * is wrong with a record: nothing is verified yet in this build, so pending is the
 * normal state for every honest entry, not a problem to fix.
 */
export const VERIFICATION_META = Object.freeze({
  [VERIFICATION_STATUSES.PENDING]: {
    label: 'Awaiting verification',
    shortLabel: 'Unverified',
    variant: 'outline',
    description:
      'Added by you. Institutions and companies can see it, marked as self-reported.',
  },
  [VERIFICATION_STATUSES.VERIFIED]: {
    label: 'Verified',
    shortLabel: 'Verified',
    variant: 'success',
    description: 'Confirmed by your institution or the issuing organisation.',
  },
  [VERIFICATION_STATUSES.REJECTED]: {
    label: 'Not verified',
    shortLabel: 'Rejected',
    variant: 'error',
    description: 'A reviewer could not confirm this record. Check the details and the proof you attached.',
  },
});

export const ACHIEVEMENT_TYPE_OPTIONS = Object.freeze([
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'competition', label: 'Competition' },
  { value: 'award', label: 'Award' },
  { value: 'scholarship', label: 'Scholarship' },
  { value: 'publication', label: 'Publication' },
  { value: 'other', label: 'Other' },
]);

export const EXPERIENCE_TYPE_OPTIONS = Object.freeze([
  { value: 'internship', label: 'Internship' },
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'apprenticeship', label: 'Apprenticeship' },
  { value: 'training', label: 'Training' },
]);

const labelLookup = (options) =>
  Object.freeze(Object.fromEntries(options.map((option) => [option.value, option.label])));

export const ACHIEVEMENT_TYPE_LABELS = labelLookup(ACHIEVEMENT_TYPE_OPTIONS);
export const EXPERIENCE_TYPE_LABELS = labelLookup(EXPERIENCE_TYPE_OPTIONS);

// --- uploads ---------------------------------------------------------------

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * The types the server will store, with the extensions a browser might report
 * them under.
 *
 * Both halves are needed because `file.type` is not reliable: a `.docx` picked on
 * some systems arrives with an empty type, and the server only accepts a declared
 * content type from its own allowlist. So the extension is the fallback for
 * working out what to declare.
 */
export const ACCEPTED_UPLOAD_TYPES = Object.freeze([
  { mimeType: 'application/pdf', extensions: ['.pdf'], label: 'PDF' },
  { mimeType: 'image/png', extensions: ['.png'], label: 'PNG' },
  { mimeType: 'image/jpeg', extensions: ['.jpg', '.jpeg'], label: 'JPG' },
  {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['.docx'],
    label: 'DOCX',
  },
  { mimeType: 'text/plain', extensions: ['.txt'], label: 'TXT' },
]);

/** For an `<input type="file" accept="...">`. Extensions and types both, so the
 *  picker filters correctly on systems that only understand one of them. */
export const FILE_INPUT_ACCEPT = ACCEPTED_UPLOAD_TYPES.flatMap((entry) => [
  ...entry.extensions,
  entry.mimeType,
]).join(',');

/** "PDF, PNG, JPG, DOCX or TXT" — for the hint under an upload button. */
export const ACCEPTED_TYPES_SENTENCE = (() => {
  const labels = ACCEPTED_UPLOAD_TYPES.map((entry) => entry.label);
  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`;
})();

/**
 * Works out which allowlisted content type to declare for a chosen file.
 *
 * Trusts `file.type` when it is one the server accepts, and falls back to the
 * extension when the browser reported nothing useful. An extension that is not on
 * the list vetoes both. Returns null when nothing matches, which the caller turns
 * into a message rather than a failed request — the server would refuse it anyway,
 * and refusing here saves the round trip and says something more specific than a
 * 400.
 *
 * @param {File} file
 * @returns {string|null}
 */
export const resolveUploadMimeType = (file) => {
  const name = String(file?.name ?? '').toLowerCase();
  const declared = String(file?.type ?? '').toLowerCase();

  // The trailing extension, if the name has one at all. `dot > 0` so a dotfile
  // like `.gitignore` counts as "no extension" rather than as an extension.
  const dot = name.lastIndexOf('.');
  const extension = dot > 0 ? name.slice(dot) : '';
  const byExtension = ACCEPTED_UPLOAD_TYPES.find((entry) => entry.extensions.includes(extension));

  // An extension that is not on the list settles it, whatever the browser
  // declared: `invoice.pdf.exe` arriving as `application/pdf` is refused here
  // rather than sent and bounced. This prevents nothing — the server re-checks the
  // declared type against the file's own magic bytes and names the stored file
  // itself — but the student gets a specific answer instead of a 400.
  if (extension && !byExtension) return null;

  const byMime = ACCEPTED_UPLOAD_TYPES.find((entry) => entry.mimeType === declared);
  if (byMime) return byMime.mimeType;

  return byExtension ? byExtension.mimeType : null;
};

/** "1.4 MB", "820 KB" — for a document row. */
export const formatFileSize = (bytes) => {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export default {
  VERIFICATION_STATUSES,
  VERIFICATION_META,
  ACHIEVEMENT_TYPE_OPTIONS,
  EXPERIENCE_TYPE_OPTIONS,
  ACHIEVEMENT_TYPE_LABELS,
  EXPERIENCE_TYPE_LABELS,
  MAX_FILE_BYTES,
  ACCEPTED_UPLOAD_TYPES,
  FILE_INPUT_ACCEPT,
  ACCEPTED_TYPES_SENTENCE,
  resolveUploadMimeType,
  formatFileSize,
};
